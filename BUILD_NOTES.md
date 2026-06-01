# BUILD NOTES FOR typrlab

> **Note (kept in sync):** This is the _original_ build plan. typrlab ultimately adopted
> **Next.js (App Router)** instead of Vite — to keep future sync/payments and SEO pages
> additive — see the [README](README.md) for the current stack and structure. The data
> model, algorithms, and analysis design below were implemented largely as written.

A pragmatic, opinionated guide to building a keybr-like adaptive typing trainer from an empty repo. Where this mirrors keybr's behavior, it cites the open-source keybr.com (github.com/aradzie/keybr.com, AGPL-3.0) implementation. Where we deviate, it says so and why.

The single most important idea to internalize before writing any code: **the entire system is built around one per-key number called `timeToType` (milliseconds per character), and a derived ratio called `confidence`. WPM is only a display transform applied at the very end.** Everything — letter unlocking, key coloring, lesson focus, progress prediction — is downstream of those two numbers. Get the data model right and the rest falls out.

---

## 1. Recommended architecture & stack

### Opinionated stack

- **Language:** TypeScript end-to-end. The math (EMA filters, polynomial regression, weighted sampling) and the data shapes are identical client and server; one language avoids reimplementing the model twice. keybr itself is a TS monorepo for exactly this reason.
- **Frontend:** React + Vite for v1 _(the project ultimately chose **Next.js (App Router)** — see the note at top — for routing + a future backend/SEO; the per-loop client rendering still applies)_. A typing trainer is a single hot loop (keydown → update text-input state → re-render one line). You do not need SSR for the practice loop. Vite/HMR (or Next dev) matters because you will iterate on the typing-input state machine constantly.
- **Rendering the typing line:** plain DOM with per-character `<span>`s styled by state class. Do **not** reach for canvas for the text line — you need per-char styling and a cursor, and the DOM handles ~80 spans trivially. Reserve canvas/SVG for the analysis charts (heatmaps over hundreds of lessons).
- **State:** a small store (Zustand or even plain `useSyncExternalStore`). The typing engine should be a **plain class, not React state** — it processes keystrokes synchronously and you subscribe React to it. Putting per-keystroke state in `useState` will cause jank.
- **Persistence (v1):** local-first. IndexedDB for the append-only results log, `localStorage` for settings. (See §8.) This is exactly keybr's model: anonymous users keep results in an IndexedDB store named `history` and settings in `localStorage` under key `settings`; nothing hits a server until you sign in.
- **Backend (v1, optional):** none. Add it only when you want cross-device sync (§8). When you do: any boring Node + SQLite/Postgres server with one binary blob per user is enough.
- **Phonetic model build:** an **offline Node script** that consumes a frequency dictionary and emits a compact per-language model artifact shipped as a static asset. This is build-time, not runtime. (See §4.)

### Module boundaries (steal keybr's package split)

keybr's separation of concerns is genuinely good; reproduce it as folders/modules even in a monolith:

```
/engine
  textinput/        # keystroke -> char-state machine (hit/miss/garbage), forgiveness, timing
  phonetic-model/   # n-gram transition table + word generator (pure, language-agnostic)
  result/           # per-lesson Result, per-key KeyStats, EMA smoothing, WPM/accuracy/score
  lesson/           # guided letter-unlock policy, Target/confidence, LearningRate prediction
/ui
  practice/         # the typing screen, virtual keyboard, gauges
  analysis/         # charts/heatmaps/percentiles
/data
  storage/          # IndexedDB results log + settings, optional remote sync
/assets
  model-en.bin      # generated phonetic model
  words-en.json     # natural word list
```

The crucial invariant: **`phonetic-model` and `result` are pure and have no UI or storage dependencies.** They take numbers in and return numbers out. This is what makes the whole thing testable (and what lets keybr ship a C++ tool that reprocesses the same binary stats files).

---

## 2. Core data model

Everything hangs off three records: the immutable **Result** (one per completed lesson), the derived **KeyStats** (one per letter, rebuilt by folding over results), and the **Settings/Profile**.

### 2.1 Result — the immutable lesson record (append-only)

This is the only thing you persist. Everything else is derived by replaying results. Treat it as an append-only log; never mutate.

```ts
type Result = {
  layout: string; // e.g. "us-qwerty"
  textType: 'guided' | 'wordlist' | 'custom' | 'numbers';
  timeStamp: number; // epoch ms when the lesson completed
  length: number; // chars typed
  time: number; // total ms spent
  errors: number; // miss count for the whole lesson
  speed: number; // CPM = (length / (time/1000)) * 60   [derived, stored for convenience]
  accuracy: number; // (length - errors) / length
  complexity: number; // # of distinct characters in the lesson (floor 3)
  score: number; // composite, see §6
  histogram: KeySample[]; // per-key counts+timing FOR THIS LESSON ONLY
};

type KeySample = {
  codePoint: number; // the key
  hitCount: number;
  missCount: number;
  timeToType: number; // ms/char for this key THIS lesson = round(sumTime / hitCount)
};
```

Mirroring keybr: per-lesson per-key `timeToType` is the **rounded mean over that key's non-typo occurrences in the lesson** (`Math.round(sumTime / count)`). **Typos do not contribute to timing** — they only increment `missCount`. Per-key sample times are **clamped to [40ms, 12000ms]** (faster than 40ms = >300 WPM, slower than 12000ms = <1 WPM are rejected as noise). The very first keystroke of each lesson is discarded (it includes "reaction time" to the new text).

**Validity gate (copy keybr exactly):** only count a result toward stats if `length >= 10 && time >= 1000ms && complexity >= 1 && speed >= 1 && distinctChars >= 3`. This throws out accidental/aborted lessons that would otherwise poison the per-key averages.

### 2.2 KeyStats — derived per-key state (the heart of the system)

Built by folding the EMA filter over every result's histogram, in chronological order, one letter at a time.

```ts
type KeyStatsMap = Map<number /*codePoint*/, KeyStats>;

type KeyStats = {
  codePoint: number;
  samples: KeySampleHistory[]; // one entry per lesson this key appeared in (for charts/regression)
  timeToType: number | null; // current EMA-smoothed ms/char (null = not yet calibrated)
  bestTimeToType: number | null; // running MIN of the SMOOTHED values
};

type KeySampleHistory = {
  index: number; // sequential lesson index (for the x-axis of charts)
  timeStamp: number;
  hitCount: number;
  missCount: number;
  timeToType: number; // raw per-lesson mean (clamped)
  filteredTimeToType: number; // the EMA value after this sample
};
```

The smoothing and `bestTimeToType` are the load-bearing detail; see §6 for the exact formula. `null` `timeToType` means "uncalibrated, needs more samples" and must render gray (not red).

### 2.3 LessonKey — the per-key view the UI and unlock logic consume

`KeyStats` is raw timing. `LessonKey` is `KeyStats` interpreted against the current target speed. This is computed fresh each lesson; it is not persisted.

```ts
type LessonKey = {
  codePoint: number;
  samples: KeySampleHistory[];
  timeToType: number | null;
  bestTimeToType: number | null;
  confidence: number | null; // = target.confidence(timeToType)      — see §5
  bestConfidence: number | null; // = target.confidence(bestTimeToType)
  isIncluded: boolean; // currently in the active alphabet
  isFocused: boolean; // the single weakest key being drilled
  isForced: boolean; // padded in by the "unlock more letters" slider
};
```

### 2.4 Settings / Profile

Make `Settings` **immutable**: `set()` returns a new instance. This makes the React re-render story trivial and prevents a class of "stale settings during a lesson" bugs. keybr does exactly this (immutable `Settings` over a private `#json`, with a pluggable storage interface).

```ts
type Settings = {
  // Guided-mode core
  targetSpeed: number; // CPM. default 175 (= 35 WPM). range 75–750 (15–150 WPM)
  alphabetSize: number; // 0..1 "unlock more letters" slider. default 0
  naturalWords: boolean; // mix real dictionary words. default true
  recoverKeys: boolean; // unlock gate uses current vs best confidence. default false
  keyboardOrder: boolean; // unlock order by keyboard rows vs pure frequency. default false

  // Lesson shape
  lessonLength: number; // 0..1 "add words". default 0 (minimum)
  capitals: number; // 0..1 fraction of words capitalized. default 0
  punctuation: number; // 0..1 punctuation injected. default 0
  repeatWords: number; // 1..10. default 1

  // Typing behavior (see §3)
  stopOnError: boolean; // default true
  forgiveErrors: boolean; // default true
  spaceSkipsWords: boolean; // default false  (NOTE: keybr's operative default is false)

  // Motivation
  dailyGoal: number; // minutes. default 30. range 0–120 (0 hides the indicator)

  // Display
  speedUnit: 'wpm' | 'cpm'; // default wpm
  language: string; // "en"
  layout: string; // "us-qwerty"
};
```

**Defaults are verified against keybr source.** `targetSpeed=175` CPM, `dailyGoal=30`, `alphabetSize=0`, `naturalWords=true`, `recoverKeys=false`, `repeatWords=1`, `stopOnError=true`, `forgiveErrors=true`. One trap worth flagging: keybr has a baseline constant where `spaceSkipsWords=true`, but the **operative user default is `false`** (`booleanProp("textInput.spaceSkipsWords", false)`). Default it to `false`.

**The internal speed unit is CPM, always.** WPM is `CPM / 5` (5 chars per word). Store and compute everything in CPM/ms; convert to WPM only in the formatter. This is the single most common source of off-by-5 bugs in typing apps.

---

## 3. The typing-input state machine

This is the part people underestimate. It is a character-by-character state machine, not a `<textarea>`. Build it as a pure class that takes keydown events and produces a styled char array + feedback signal.

### Char states (drive your CSS)

- **Normal** — untyped, ahead of the cursor.
- **Hit** — typed correctly (e.g. muted/green text).
- **Miss** — wrong char at the cursor position (red).
- **Garbage** — extra characters typed past an error (red text on red background). Only shown when `stopOnError=false`.
- **Cursor** — the char currently under the cursor (configurable shape: block/box/line/underline).

### Behavior, defaulting to keybr's "forgiving but stopping" model

- **`stopOnError=true`:** the cursor does **not** advance past a wrong key. The lesson **pauses**, it does **not** end. You correct by typing the right key (backspace also works). There is no "fail the test" state — feedback is only `Succeeded | Recovered | Failed` per keystroke.
- **`forgiveErrors=true`:** auto-recover from a single substituted or skipped character using a **3-character lookahead**. Concretely: buffer up to ~10 "garbage" chars; if the next 3 buffered chars match the upcoming expected text, commit a single typo + the buffered correct chars and emit `Recovered`. This keeps a momentary fumble from stalling the whole line.
- **`spaceSkipsWords` (default false):** when on, space jumps to the first char of the next word.

### Per-keystroke timing (get this right or all stats are garbage)

Inter-keystroke duration = `timeStamp - previousTimeStamp`. Then **divide by `(modifierCount + 1)`** so a capital letter (Shift held) splits its time fairly between the modifier and the letter. Dead keys reset the start timestamp so the dead-key wait isn't charged to the next char. Feed only **non-typo** hits into the timing accumulator.

### Critical lifecycle detail

On window blur / tab switch / `visibilitychange`, **reset the current lesson** (clear the line, don't record a partial result). keybr does this aggressively. The reason: if the user alt-tabs mid-word, the inter-keystroke gap on return would be enormous and would corrupt that key's `timeToType`. Resetting is the cheapest correct behavior. A lesson that completes generates the next one immediately — practice is a continuous loop, no "next" button.

---

## 4. Lesson generation: the n-gram phonetic model

The guided mode generates pronounceable pseudo-words from a per-language **letter-transition (Markov) model**, constrained to the currently-unlocked letters and biased toward the weakest one. This is what makes early lessons feel like words ("ten", "nat", "ane") instead of random gibberish ("tne", "ntae").

### 4.1 What the model is

A **4-gram letter-transition table**: each next letter is conditioned on the previous **3** letters. (keybr constructs it as `new TransitionTableBuilder(4, [0x0020, ...alphabet])` — the `4` is the tuple width. In strict Markov terms that is a **3rd-order chain**; call it a "4-gram / order-4 tuple model" to avoid the off-by-one confusion. Do not be misled by the model also exposing `ngram1`/`ngram2` unigram/bigram views — those are _derived marginal_ tables used for things like keyboard heat coloring, **not** the generation order.)

The data structure: for every 3-letter **context**, store a segment of `{codePoint, frequency}` entries giving the count of each possible next character. Index it as a base-`alphabetSize` number into a flat array:

```
size      = alphabet.length            // includes the space char 0x0020
segments  = size^(order-1)  = size^3   // one per 3-letter context
width     = size^order      = size^4   // total entries
```

### 4.2 How to build it (offline script, build-time)

```
1. Load a frequency dictionary for the language: CSV of (word, count).
   (Good free source: a frequency word list, e.g. from a large corpus.)
2. Lowercase, dedupe case-insensitively, sort by count desc, take top 10,000.
3. For each word with length >= 3:
     append it to the builder `count` times   // frequency weighting: common words dominate
4. Sliding a length-4 window across each word (padded front/back with the space char 0x0020),
   increment the matching transition entry by 1.
5. Serialize the table to a compact binary asset: assets/model-<lang>.bin
6. Also emit a natural word list assets/words-<lang>.json (real words, length > 2).
```

Ship `model-en.bin` + `words-en.json` as static assets. Each language is fully independent — its own table trained only on its own corpus — which is why impossible bigrams (e.g. "zw" in English) never appear in output.

### 4.3 How generation works (runtime, pure function)

`nextWord(filter, rng)` is a **weighted random walk**:

```
minLength = 3, maxLength = 10

word = seed prefix (see "focus" below)
loop:
  context = last 3 code points of word
  entries = table.segment(context)
  entries = entries.filter(e => e.codePoint == SPACE || filter.includes(e.codePoint))
            // ^ only ever emit UNLOCKED letters; lock everything else out
  for the SPACE entry, boost its weight:  freq *= 1.3 ^ word.length
            // ^ longer words become exponentially more likely to terminate -> keeps within max
  next = weightedRandomSample(entries, e => e.freq, rng)
  if next == SPACE and word.length >= minLength: break
  word.push(next)
  if word.length >= maxLength: break
retry up to 5 times if you dead-end (no valid next char)
```

### 4.4 Weighting toward target letters (the `Filter`)

Two-part filter passed into generation:

1. **Allowed set** — the unlocked/included letters. `filter.includes(cp)` is true only for unlocked letters; every sampling step drops locked letters. This is what makes early lessons use only your 6 starting keys.
2. **Focused letter** — the single weakest key (§5). The focused letter is **forced into the word via prefix seeding**: seed generation from a precomputed prefix that contains the focus letter (or a bare `[focusLetter]` prefix if none match). This guarantees the target letter appears, while the rest of the walk stays inside the allowed set. The focus letter is _seeded at the start_; the rest of the word is constrained, not forced.

### 4.5 Natural-words mode (default on)

Even in guided mode, prefer **real words** when enough match the current letter set:

```
if naturalWords:
  words = dictionary.find(filter).slice(0, 1000)   // real words using only unlocked letters
  while words.length < 15:
    words.push(pseudoWord())                        // pad with model output
  if words.length == 0: words = ["?"]               // degenerate fallback
  return randomFrom(words)
else:
  return pseudoWord()
```

Early on (few letters unlocked) almost nothing matches, so you get mostly pseudo-words; as the alphabet grows, real words dominate. This is a nice UX gradient and costs nothing.

**Adaptation note:** building a 4-gram model is the "do it properly" path. For an MVP you can ship with **only the natural word list filtered by unlocked letters**, and skip the model entirely — accept that very early lessons (6 letters) will be thin. Add the phonetic model in v1 when you want smooth early lessons. (See §9 phasing.)

---

## 5. Unlock / target-speed logic (concrete pseudocode)

This is the adaptive core. Letters are introduced one at a time, frequency-ordered, gated on a speed threshold per key.

### 5.1 Confidence — the one ratio everything keys off

```ts
// target time-per-char at the configured target speed, in ms
speedToTime(cpm) = 1000 / (cpm / 60)      // CPM -> ms/char
timeToSpeed(ms)  = 60000 / ms             // ms/char -> CPM

confidence(timeToType) = speedToTime(targetSpeed) / timeToType
                       = (target ms/char) / (your ms/char)
                       = yourSpeed / targetSpeed
```

So **`confidence >= 1` means you are typing that key at or above target speed.** It is a pure speed ratio — NOT a sample count, NOT statistical certainty. `bestConfidence` is the same formula applied to `bestTimeToType` (your best-ever smoothed time on that key).

Default `targetSpeed = 175 CPM = 35 WPM`. The whole "raise the bar and relearn" loop: once you've unlocked all letters, bump `targetSpeed` and every key drops below confidence 1 again, re-triggering the focus/unlock machinery at a higher standard.

### 5.2 The unlock + focus algorithm

```
function updateLessonKeys(keyStatsMap, settings):
    letters = languageLetters in (keyboardOrder ? keyboard-weighted : frequency) order
    keys    = letters.map(l => LessonKey.from(keyStatsMap[l], target))

    minSize = 6
    maxSize = minSize + round((letters.length - minSize) * settings.alphabetSize)
    // alphabetSize default 0  ->  maxSize == 6  ->  growth is purely confidence-gated

    recover = settings.recoverKeys           // default false
    confOf  = key => recover ? key.confidence : key.bestConfidence

    included = []
    for key in keys:
        if included.length < minSize:
            include(key); continue            // force the first 6

        if (key.bestConfidence ?? 0) >= 1:
            include(key); continue            // ALWAYS keep keys you've already mastered

        if included.length < maxSize:
            include(key, forced=true); continue   // "unlock more letters" padding

        // The gate: unlock the NEXT new letter only when EVERY included key clears it.
        if included.every(k => (confOf(k) ?? 0) >= 1):
            include(key)
            break          // unlock exactly one new letter per qualifying lesson
        else:
            break          // not ready; stop here

    // Focus: drill the single weakest included key still below target.
    weakest = included.filter(k => confOf(k) < 1)
                      .sort(by confOf ascending)
    if weakest.length > 0:
        focus(weakest[0])

    return included (with focus + forced flags)
```

### 5.3 `recoverKeys` — the one subtle toggle

- **`recoverKeys=false` (default):** the gate uses `bestConfidence`. You only have to hit target speed **once** on each key; one good run "banks" it. Decayed keys don't re-lock progress.
- **`recoverKeys=true`:** the gate uses current `confidence`. A key that has slipped below target **re-locks further unlocking** until you bring all current keys back above target. Harder, better retention.

The distinction is real and worth a unit test: with previous keys at _current_ confidence 0.9 but _best_ confidence 1.0, `recoverKeys=false` unlocks a new letter while `recoverKeys=true` refuses and re-focuses the weakest old key. (keybr's own test fixtures encode exactly this case.)

### 5.4 Learning-rate / "lessons remaining" prediction (nice-to-have)

For the per-key chart's "N more lessons to target":

```
samples = last 30 samples for the key
          (optionally trimmed to the latest "learning session":
           cut on a >1h gap or a sustained slowdown run)
degree  = samples > 20 ? 3 : samples > 10 ? 2 : 1     // cubic / quadratic / linear
fit     = polynomialRegression(speed vs lessonIndex, degree)
r2      = certainty(fit)
if r2 >= 0.5:
    learningRate    = fit.derivative().eval(lastIndex)   // WPM gained per lesson
    remainingLessons = first i in 1..50 where fit.eval(lastIndex + i) >= targetSpeed
```

Defer this to v1+. It's motivational polish, not core.

---

## 6. The per-key smoothing formula (exact)

Per-key `timeToType` is an **exponential moving average (EMA)** across lessons, **not** a plain mean. This matters: a single slow lesson shouldn't tank a key, and a single fast lesson shouldn't instantly "win" it.

```ts
// alpha = 0.1  (keybr's value)
makeFilter(alpha):
    n = 0; value = NaN
    add(v):
        n += 1
        value = (n > 1) ? alpha * v + (1 - alpha) * value
                        : v                    // first sample seeds the state
        return value
```

Folding it per key, in chronological order over all results:

```ts
for each result (oldest -> newest):
  for each KeySample in result.histogram:
    raw = clamp(sample.timeToType, 40, 12000)         // reject noise
    filtered = filter.add(raw)                         // EMA, alpha = 0.1
    key.timeToType     = filtered
    key.bestTimeToType = min(key.bestTimeToType ?? Inf, filtered)   // min of SMOOTHED, not raw
    key.samples.push({ index, timeStamp, raw, filtered, hitCount, missCount })
```

Two non-obvious points, both load-bearing:

1. **`bestTimeToType` is the running minimum of the _smoothed_ values**, never of the raw per-lesson times. This is why `bestConfidence` (and thus the default unlock gate) reflects sustained best performance, not a single lucky keystroke.
2. **Lesson-level summary stats (avg/min/max/last/delta) are plain cumulative aggregates, NOT EMA.** Only the _per-key_ `timeToType` uses the EMA. Keep these two paths separate — `avg = sum/count`, `delta = last - avg`.

### Other formulas you need

```
// per lesson:
speed    = (length / (time/1000)) * 60          // CPM
accuracy = (length - errors) / length           // 0..1
score    = (speed * complexity / (errors + 1)) * (length / 50)   // composite; rewards fast+long+varied, punishes errors

// display:
wpm = cpm / 5
```

---

## 7. The analysis page — what to compute & render

A fixed, ordered set of sections. Render them unconditionally (no paywall — see §8). Each is derived purely from the results log + the KeyStats fold.

**Summary scorecards (no axes):**

1. **All-Time Summary** — Time practiced, Lessons count, Top speed, Average speed, Top accuracy, Average accuracy.
2. **Today Summary** — same six, filtered to today.

**Time-series / learning curves:** 3. **Typing Speed (learning curve).** X = lesson number; left Y = speed; right Y = accuracy. Scatter three smoothed series — speed, accuracy, and complexity (distinct-key count, floor 3) — plus a bold **linear-regression trend line** through speed. Add a user **smoothness slider** (exponential smoothing, default 0.5) to damp noise. Insight: _am I getting faster while accuracy holds as new keys come in?_ 4. **Learning Progress Overview (per-key heatmap).** X = lesson number; Y = one row per letter; each cell colored by that key's **confidence at that lesson** (red→green). This is the canonical "keys turn green as you master them" view across all of history.

**Per-key drill-down:** 5. **Key Typing Speed.** A key selector; X = lesson, Y = speed for that key; scatter + regression curve + a horizontal **target-speed threshold line**. Optionally extend the x-axis with a "Now" marker and the lessons-remaining projection (§5.4). 6. **Key Typing Speed Histogram.** Bars = average speed per key (Y = speed from 0, X = keys). 7. **Key Frequency Histogram.** Three stacked panels per key: hit count, miss count, and **miss/hit ratio** (`missCount/hitCount` — the per-key relative error rate). The ratio panel is the most actionable: it surfaces keys you hit _often but wrong_. 8. **Key Frequency Heatmap.** Overlay the virtual keyboard with two color layers — hit count and miss count per key — so the user literally sees which keys they press most and miss most.

**Benchmark (percentile):** 9. **Relative Speed / Relative Accuracy histograms.** Plot a **precomputed static empirical distribution** of all users (a baked-in histogram JSON), show the PMF bars + a CDF curve, and draw a vertical line at the user's average (or top) value with the sentence _"Your average speed beats X% of all people"_ via `distribution.cdf(value)`. **This is computed entirely client-side against a static asset — not a live query.** Caveat to internalize: that reference distribution is frozen at build time and goes stale as your real population improves; periodically regenerate it from your own aggregated data. (keybr's `dist_speed.json` / `dist_accuracy.json` haven't been updated since 2024.)

**Engagement:** 10. **Accuracy Streaks.** Longest consecutive runs of lessons clearing accuracy tiers **100% / 97% / 95%**, each row showing lessons, characters, top/avg speed, start date. 11. **Practice Calendar.** GitHub-style activity calendar, days colored by effort.

**Charts NOT on this page (they belong to the post-lesson result view):** a within-lesson rolling-speed chart (speed vs elapsed time, with typo "bumps") and a per-keystroke time-to-type histogram for the just-finished lesson. Keep these on the practice screen, not the long-term analysis page.

**Post-lesson gauges (on the practice screen):** three gauges — Speed, Accuracy, Score — each with a **delta vs. your running average** (↑/↓). Plus celebratory alerts for: new top speed (fire only after ≥3 results), new top score, newly unlocked letter, daily-goal reached.

---

## 8. Persistence: local-first, then optional accounts

**v1 is local-first. No account required, and that's a feature.**

### Anonymous (default)

- **Results:** append-only log in **IndexedDB**, object store `history`, `autoIncrement: true`, each `Result` stored as JSON. Replay the whole log on load to rebuild `KeyStatsMap` via the EMA fold (it's cheap — thousands of lessons fold in milliseconds). This is keybr's exact model.
- **Settings:** **`localStorage`** under key `settings`, as JSON. (Note: settings live in `localStorage`, _not_ IndexedDB — don't conflate the two.)
- Clearing browser data wipes progress; surface this honestly and offer an export (dump the results log as a file).

### Signed-in (add later, only for cross-device sync)

When you add accounts, the cleanest design (and keybr's):

- Keep the **local IndexedDB log as-is**; signing in _adds_ server sync, it doesn't replace local.
- **Results** sync as one **append-only binary blob per user** (a `stats.data` file / `application/octet-stream`). GET to pull, POST to push, DELETE to clear.
- **Settings** sync as JSON over a separate endpoint.
- **Conflict policy: server is source of truth, no merge.** On load: if the server has data, use it and ignore local. If the server is empty, upload the local log once (first-sign-in migration), clear local, then use the server copy. This is dramatically simpler than CRDT-style merging and is fine because results are an append-only log keyed by timestamp — you rarely have genuine divergence, and "newest device wins on the blob" is acceptable for a typing trainer. Don't over-engineer this.
- **Auth:** passwordless. Email magic-link + OAuth (Google/Microsoft) covers everyone with minimal liability. No passwords to store or leak.
- **Account controls:** "Anonymize me" (hide public name), "Sign out", "Delete account" (wipes PII), and a _separate_ "clear my typing stats" on the analysis page.

### Monetization stance (if you ever charge)

**Do not paywall analytics or learning features.** keybr's entire stats/chart/percentile/prediction surface is free; premium is a one-time lifetime payment that only removes ads/trackers and speeds page loads (`premium: boolean`, gating ad UI only). Gate _ads and convenience_, never the adaptive engine or the charts — those are the product's reason to exist.

---

## 9. Phased build order: MVP → v1

### Phase 0 — skeleton (½ day)

Next.js (App Router) + React + TS. The `engine/result` types. A WPM/CPM formatter with a unit test (the off-by-5 trap). The immutable `Settings` class.

### Phase 1 — MVP: a typing loop that records (2–3 days)

- **Typing-input state machine** (§3): char states, `stopOnError` only (skip `forgiveErrors` for now), per-keystroke timing with the `/(modifiers+1)` split, blur-resets-lesson.
- **Lesson text from a filtered word list only** — real words restricted to a hardcoded 6-letter starting set. No phonetic model yet.
- On completion: build a `Result`, validity-gate it, append to **IndexedDB**.
- Render the typing line + a simple post-lesson Speed/Accuracy readout.
- **Milestone:** you can type, it records, and reloading the page replays the log.

### Phase 2 — the adaptive core (2–3 days)

- **KeyStats fold** with the **EMA filter (alpha 0.1)** and `bestTimeToType` (§6).
- **`Target` / confidence** (§5.1) and the **unlock + focus algorithm** (§5.2), including `minSize=6`, the every-key gate, and `recoverKeys`.
- **Virtual keyboard** colored by per-key confidence (red→green gradient; gray = uncalibrated); highlight the focused key.
- Bias lesson text toward the focused letter (even with just the word-list approach: prefer words containing the focus letter).
- **Milestone:** letters unlock one at a time as you hit target speed; the keyboard greens up. This _is_ the keybr experience, minus pretty pseudo-words.

### Phase 3 — v1 polish (1 week)

- **Phonetic model** (§4): write the offline build script, ship `model-en.bin`, swap generation to the weighted random walk with focus-prefix seeding + natural-words fallback. Now early lessons read like words.
- **`forgiveErrors`** 3-char-lookahead recovery; garbage chars; cursor shapes.
- **Post-lesson gauges** with deltas; **daily goal**; **accuracy streaks**; celebratory alerts.
- **Analysis page** (§7): start with the learning curve, the per-key confidence heatmap, and the key-frequency heatmap/histograms. Add the percentile benchmark once you have a distribution to bake (initially seed it from a public dataset or your own beta users).
- Settings UI for target speed, daily goal, natural words, recover keys, typing behavior.

### Phase 4 — v1+ (optional, demand-driven)

- **Learning-rate prediction** ("N lessons to target", §5.4).
- **Accounts + cross-device sync** (§8): passwordless auth, per-user binary blob, server-as-truth no-merge.
- More **languages** (each = one corpus → one `model-<lang>.bin` + word list) and **layouts**.
- Extra modes: word list, custom text, numbers (apply Benford weighting to the leading digit if you do numbers).

---

## 10. Pitfalls checklist (things that will bite you)

- **Everything in CPM/ms internally; WPM only at the formatter.** `WPM = CPM / 5`.
- **Per-key `timeToType` is EMA (alpha 0.1), not a mean. `bestTimeToType` is the min of the _smoothed_ values.** Lesson summary aggregates are plain means — different code path.
- **Confidence is a speed ratio, not certainty.** `confidence >= 1` == at/above target. `null` == uncalibrated == render gray.
- **Typos never contribute to timing** — they only bump `missCount`. Clamp per-key sample times to [40ms, 12000ms]; drop the first keystroke of each lesson.
- **Reset (don't record) on blur/tab-switch.** A returning alt-tab would corrupt a key's timing otherwise.
- **The unlock gate is "_every_ included key clears confidence ≥ 1", not "the focused key."** And by default it uses `bestConfidence` (banked once), unless `recoverKeys` is on.
- **The percentile distribution is a static baked asset** — it goes stale; plan to regenerate it.
- **`spaceSkipsWords` default is `false`** despite a misleading baseline constant.
- **Keep `phonetic-model` and `result` pure** (no UI, no storage). It's the only way the math stays testable.
