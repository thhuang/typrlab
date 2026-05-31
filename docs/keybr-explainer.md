# How keybr.com Works: A Deep Technical Explainer

This document reconstructs the architecture and algorithms behind keybr.com, grounded in its open-source frontend (an AGPL-3.0 TypeScript monorepo at github.com/aradzie/keybr.com, by Aleksei Radzievski). Unless otherwise noted, every claim is traced to a source file on the `master` branch. Where a fact could only be verified for the open-source code and might drift from the live production deployment, that is flagged explicitly.

---

## A. The Practice Page & Lesson Flow

### The screen

The practice page is the default landing screen — a single-page typing trainer dominated by a horizontal "text board" (one rolling line of generated text) above a full virtual keyboard. The board's text "is generated automatically from the current subset of letters," and the keyboard is a learning aid ("There are small bumps on the F and J keys") (`packages/page-practice/lib/practice/PracticeTour.tsx`).

The default lesson mode is `LessonType.GUIDED` (`packages/keybr-lesson/lib/lessontype.ts`). There are six lesson types in total:

| Type | id | Text type | Notes |
|---|---|---|---|
| Guided | `guided` | GENERATED | Default. Phonetic pseudo-words over a dynamically expanding letter set |
| Word list | `wordlist` | NATURAL | Common words; `wordListSize` default 1000 (10–1000); `longWordsOnly` |
| Books | `books` | NATURAL | e.g. Alice in Wonderland; paragraph navigation |
| Custom text | `custom` | NATURAL | Your own text, default the pangram, up to 10,000 chars |
| Code | `code` | CODE | Syntax default HTML |
| Numbers | `numbers` | NUMBERS | 3–7 digit groups to ≥50 chars; Benford weighting on leading digit |

(`packages/keybr-lesson/lib/lessontype.ts`)

### How a single lesson runs

A lesson is one line of text. When you finish typing it (`textInput.completed` becomes true), `#onResult()` fires, the result is recorded, and a fresh `LessonState` is constructed immediately, generating new text — so practice is continuous with no explicit "next" click (`packages/page-practice/lib/practice/state/lesson-state.ts`, `Controller.tsx`).

Characters are styled by state through the `keybr-textinput-ui` package: untyped text is normal; correctly typed characters get the `Hit` style (`--textinput--hit__color`); an incorrect character at the cursor gets `Miss` (`--textinput--miss__color`); and extra "garbage" characters get a `Garbage` style (miss-color text on a miss-colored background) (`packages/keybr-textinput-ui/lib/styles.ts`). The character under the cursor is marked with a `cursor` class; cursor shape (Block / Box / Line / Underline) and motion (Jumping / Smooth) are configurable.

### Error handling (this is subtle and important)

A lesson never ends or hard-stops on error. The default text-input behavior, defined by `textInputProps` in `packages/keybr-textinput/lib/settings.ts`, is:

| Setting | Default | Effect |
|---|---|---|
| `stopOnError` | **true** | Cursor does not advance past a wrong key until corrected; errors don't accumulate as visible garbage |
| `forgiveErrors` | **true** | Auto-recovers from a single wrong/replaced char or a skipped char, using a 3-char lookahead |
| `spaceSkipsWords` | **false** | (Corrected — see note below) |

> **Verification correction:** Earlier descriptions claimed `spaceSkipsWords` defaults to `true`. That is wrong for the user-facing default. The operative prop is `booleanProp("textInput.spaceSkipsWords", false)` — it defaults to **false**. (There is a separate static baseline constant `textInputSettings` in the same file that sets it to `true`, but that constant does not govern application user settings; it is the likely source of the original error.) (`packages/keybr-textinput/lib/settings.ts`)

The forgiveness mechanism lives in `packages/keybr-textinput/lib/textinput.ts`: `const recoverBufferLength = 3`. When `forgiveErrors` is on, two routines — `#handleReplacedCharacter()` (single substituted char) and `#handleSkippedCharacter()` (single omitted char) — buffer the mistyped "garbage" (capped at `garbageBufferLength = 10`) and check whether the next 3 expected characters match what you actually typed. If they do, the input commits a typo step plus the buffered correct steps and returns `Feedback.Recovered`. The `Feedback` enum is only `{ Succeeded, Recovered, Failed }` — there is no "lesson ended" feedback, confirming errors never terminate the lesson.

### Focus model

The focus handling is aggressive: blurring the window, losing focus, or switching tabs **resets** (not pauses) the current lesson. `Controller.tsx` attaches `useWindowEvent("blur"/"focus", handleResetLesson)` and a `visibilitychange` handler that clears the current lines and depressed keys (`packages/page-practice/lib/practice/Controller.tsx`).

### Controls and indicators

Practice-screen controls: Help/tour, Reset lesson (**Ctrl+Left Arrow**), Skip lesson (**Ctrl+Right Arrow**), a view-switch button, and Settings (`packages/page-practice/lib/practice/Controls.tsx`).

After each lesson, three gauges are shown, each with a delta versus your running average (↑/↓):

| Gauge | Meaning | Format |
|---|---|---|
| Speed | "typing speed in the last lesson" | WPM or CPM |
| Accuracy | "percentage of characters typed without errors" | % |
| Score | "abstract points... greater when you type faster and with fewer errors" | number |

(`packages/keybr-lesson-ui/lib/gauges.tsx`)

> The exact between-lesson visual flow (distinct modal vs inline panel) is **medium confidence** — `Presenter.tsx` was summarized but not read line-by-line.

### Motivation features

- **Daily goal:** `dailyGoal` default **30 minutes**, range 0–120. Progress = (today's total ms / 1000 / 60 / goal), clamped to [0,1]; the indicator only renders when goal > 0 (`packages/keybr-lesson/lib/settings.ts`, `dailygoal.ts`).
- **Accuracy streaks:** three tiers — `level1 = 1.0` (100%), `level2 = 0.97` (97%), `level3 = 0.95` (95%) — track consecutive lessons clearing each threshold (`packages/keybr-result/lib/accuracy.ts`).
- **Celebratory event alerts** fire for: new top speed (after ≥3 results), new top score, a newly unlocked letter, and daily-goal-reached (`packages/page-practice/lib/practice/state/event-source-*.ts`).

> The exact user-facing wording of these alerts could not be quoted — the hosted page is JS-rendered, and only the event types/message IDs were captured.

### Guided sub-settings (and their defaults)

| Setting | Default | Range |
|---|---|---|
| Target typing speed | 175 CPM (= 35 WPM) | 75–750 CPM |
| Unlock more letters (`alphabetSize`) | 0 | 0–1 |
| Natural words | on (`true`) | — |
| Keyboard order | off (`false`) | — |
| Recover keys | off (`false`) | — |
| Add words to lessons (`length`) | min | 0–1 |
| Add capital letters | 0% | 0–100% |
| Add punctuation characters | 0% | 0–100% |
| Repeat words | 1 | 1–10 |

(`packages/keybr-lesson/lib/settings.ts`, and the corresponding `*Prop.tsx` files)

---

## B. The Adaptive Letter-Unlocking + Target-Speed Mechanic

This is the heart of the GUIDED mode. The whole system runs on one per-key number called **confidence**.

### Confidence

Per-key confidence is defined in `packages/keybr-lesson/lib/target.ts`:

```
confidence(timeToType) = speedToTime(targetSpeed) / timeToType
```

`speedToTime(cpm)` converts a target speed (in characters per minute) to a target time-per-character in milliseconds (`1000 / (cpm / 60)`), and `timeToType` is your actual (smoothed) ms-per-character for that key. Both numerator and denominator are times-per-keystroke, so confidence is a **dimensionless speed ratio** = yourSpeed / targetSpeed.

- **confidence ≥ 1** means you are typing that key at or above the target speed.
- It is **not** a statistical certainty and **not** a sample count. The per-key sample count is carried as a separate field on `LessonKey` and never folded into confidence (`packages/keybr-lesson/lib/key.ts`).

### Target speed

The internal unit is **CPM** (characters per minute). The default target is **175 CPM = 35 WPM** (the WPM divisor is 5 — `SpeedUnit.WPM` factor = 1/5 in `packages/keybr-result/lib/speedunit.ts`), adjustable **75–750 CPM (15–150 WPM)** (`numberProp("lesson.targetSpeed", 175, { min: 75, max: 750 })`). The displayed unit (CPM vs WPM) is a separate UI preference; the stored value is always CPM, and the slider's prev/next buttons snap to multiples of 5 (`packages/page-practice/lib/settings/lesson/TargetSpeedProp.tsx`).

### The unlock rule

The logic is in `GuidedLesson.update()` (`packages/keybr-lesson/lib/guided.ts`). Letters are ordered by language frequency. The active alphabet is sized:

```
minSize = 6
maxSize = minSize + Math.round((letters.length - minSize) * alphabetSize)
```

With the default `alphabetSize = 0`, `maxSize = 6` and growth is purely confidence-gated (no extra "forced" padding keys). Below `minSize`, keys are force-included regardless of confidence.

Once the included set has reached the size limit, the algorithm decides whether to unlock the **next** not-yet-confident letter. Two things happen per iteration:

1. Any individual key the user has already mastered is unconditionally re-included: `if ((lessonKey.bestConfidence ?? 0) >= 1) { lessonKeys.include(...) }` ("Must include all confident keys").
2. A new letter is unlocked **only when every already-included key clears the confidence gate** — and which confidence is used depends on the `recoverKeys` setting:

```js
if (recoverKeys) {
  if (includedKeys.every((key) => (key.confidence ?? 0) >= 1)) { lessonKeys.include(...) }
} else {
  if (includedKeys.every((key) => (key.bestConfidence ?? 0) >= 1)) { lessonKeys.include(...) }
}
```

`recoverKeys` defaults to **false**, so the default gate uses **`bestConfidence`** — each prior key only had to reach target speed **once** (best-ever). One good run "banks" a key. With `recoverKeys` on, the gate uses **live** `confidence`, so all prior keys must be above target speed *right now*, and a key that has decayed re-locks further progress until you recover it.

> This distinction is proven by the repo's own unit test (`guided.test.ts`): with prior keys at current-confidence 0.9 but bestConfidence 1, `recoverKeys` off unlocks a new key while `recoverKeys` on unlocks nothing and re-focuses the weakest old key. The test groups are literally named "all previous keys are now above the target speed" vs "all previous keys were once above the target speed."

`bestConfidence` is computed from `bestTimeToType` (your best-ever smoothed time) (`packages/keybr-lesson/lib/key.ts`).

### Weakest-key drilling ("focus")

After updating inclusion, the lesson focuses on a single weakest key:

```js
const weakestKeys = lessonKeys.findIncludedKeys()
  .filter((key) => confidenceOf(key) < 1)
  .sort((a, b) => confidenceOf(a) - confidenceOf(b));
if (weakestKeys.length > 0) { lessonKeys.focus(weakestKeys[0].letter); }
```

So the single least-confident included key (confidence strictly < 1) becomes the focused key (`packages/keybr-lesson/lib/guided.ts`). Text generation then over-samples that letter (see Section C).

### Per-key color

Key color is a continuous gradient by confidence, not discrete dots or stars: `confidenceColor(confidence) = mixColors(slowColor, fastColor, confidence)` with `--slow-key-color` defaulting to **#cc0000 (red)** at confidence 0 and `--fast-key-color` to **#60d788 (green)** at confidence 1 (clamped) (`packages/keybr-lesson-ui/lib/styles.ts`). The TargetSpeed tooltip phrases it as "The closer to the target speed, the greener." A key with no data yet renders as `lessonKey_uncalibrated` ("Not calibrated, need more samples"). Other CSS states: `lessonKey_included` / `lessonKey_excluded` (excluded keys draw an SVG cross), `lessonKey_focused`, and `lessonKey_forced` (`packages/keybr-lesson-ui/lib/Key.tsx`).

> Exact intermediate color stops in the red→green ramp live in theme files that were not opened; only the two endpoint variables were confirmed.

---

## C. Phonetic Pseudo-Word Generation (the n-gram model)

Guided text is generated by a per-language letter-transition model in the `@keybr/phonetic-model` package. The model is built **offline** and shipped to the browser as a compact binary asset.

### Build-time model construction

`packages/keybr-generators/lib/generate-languages.ts` reads a frequency dictionary, takes the **top 10,000** unique words (`sortByCount(...).slice(0, 10000)`), restricts to words of length ≥ 3, and appends each word to the builder `count` times (so frequent words dominate the statistics). The builder is constructed as:

```js
const builder = new TransitionTableBuilder(4, [0x0020, ...alphabet]);
```

The output is written to `packages/keybr-phonetic-model/assets/model-<lang>.data` (binary, signature bytes "keybr.com"), alongside a real-word list `packages/keybr-content-words/lib/data/words-<lang>.json`.

### What "order 4" actually means

> **Terminology correction.** The constructor argument `4` is the **chain tuple width** — a **4-gram (n=4) letter model**, where each next letter is conditioned on the previous **3** letters. In strict Markov terminology that is a **3rd-order Markov chain** (memory = order − 1 = 3). Describing it as "4th-order Markov" is imprecise; describing it as a "2nd-order Markov chain" is simply wrong (that confusion arose from the `ngram1()`/`ngram2()` accessors, which are *derived marginal* unigram/bigram views used elsewhere — e.g. keyboard heat coloring — and are **not** the generation order).

The data structure (`packages/keybr-phonetic-model/lib/transitiontable.ts`) is a `Chain` of order n=4 over an alphabet of size `size`, with:

```
segments = size^(order-1)   // = size^3 distinct 3-letter contexts
width    = size^order        // = size^4 entries
```

Each 3-character context indexes a "segment" of `{codePoint, frequency}` entries giving the count of each possible next character. The builder slides a window `new Array(order).fill(0x0020)` across each word, so word starts and ends are padded with the space code point `0x0020` (`builder.ts`).

> The exact on-disk numeric quantization of the frequencies (8-bit vs 16-bit vs full counts) in `compress()`/`load()` was not read and remains uncertain.

### Generation: a weighted random walk

`PhoneticModel.nextWord(filter, random)` (`packages/keybr-phonetic-model/lib/phoneticmodel.ts`) builds a word as a weighted random walk:

- `minLength = 3`, `maxLength = 10`.
- The word is seeded with a prefix (see focus below), then repeatedly looks up `table.segment(word)` (entries for the trailing 3-gram context), filters out disallowed letters, and picks the next character via `weightedRandomSample` proportional to transition frequency.
- The space character `0x0020` terminates the word; its weight is boosted by `frequency * Math.pow(1.3, word.length)` so longer words become exponentially likelier to end, keeping words within bounds.
- Up to 5 retries if the walk dead-ends.

### Injecting the target letters

A `Filter` object (`packages/keybr-phonetic-model/lib/filter.ts`) carries two things: a `CodePointSet` of currently-unlocked letters and a single `focusedCodePoint`. `includes(codePoint)` returns true only for unlocked letters (`codePoints == null || codePoints.has(codePoint)`), so locked letters are rejected at every sampling step.

The focused (weakest) letter is forced into the word via prefix seeding. `findPrefixes(filter)` returns pre-computed prefixes containing the focused letter, falling back to a bare `[new Prefix([focusedCodePoint])]` when none match — guaranteeing the target letter can appear at the word start. The rest of the walk is constrained to the unlocked-letter set (not forced to repeat the focus). Guided assembles this filter as `new Filter(lessonKeys.findIncludedKeys(), lessonKeys.findFocusedKey())` (`packages/keybr-lesson/lib/guided.ts`).

### Natural-words mode

Even GUIDED prefers real words by default. `GuidedLesson.#makeWordGenerator` (with `naturalWords` on, the default) pulls up to 1000 real dictionary words matching the filter (`this.dictionary.find(filter).slice(0, 1000)`, keeping only words longer than 2 chars), and pads with phonetic pseudo-words only when fewer than 15 real words match the currently-unlocked set:

```js
const words = this.dictionary.find(filter).slice(0, 1000);
while (words.length < 15) { const word = pseudoWords(); ... }
```

So pure pseudo-words dominate early (few unlocked letters → few matching real words) and recede as the alphabet grows (`packages/keybr-lesson/lib/guided.ts`).

### Multi-language

Each language ships its own independent `model-<lang>.data` and `words-<lang>.json`, and is registered in `packages/keybr-keyboard/lib/language.ts` (id, script, direction, alphabet). Because a model is trained only on that language's words, impossible bigrams (e.g. "zw" in English) never appear (`docs/custom_language.md`).

> Whether the 3/10 length bounds or the 1.3 termination base are ever overridden per-language/by settings was not confirmed.

---

## D. The Per-Key Speed Model & Smoothing

The internal performance unit is **not** WPM — it is **time-to-type** (`timeToType`), the milliseconds spent on a single character. WPM is purely a final display transform.

### Per-keystroke measurement

`TimeToType.measure()` (`packages/keybr-textinput-events/lib/timetotype.ts`) computes inter-keystroke duration as `timeStamp - previousTimeStamp`, then divides by `(modifierCount + 1)` so a character requiring Shift/Alt/AltGraph/Dead keys gets its time fairly split across the keypresses. Dead keys reset the start timestamp so the dead-key wait isn't charged to the next character.

### Per-lesson aggregation

`Histogram.from(steps)` (`packages/keybr-textinput/lib/histogram.ts`) accumulates per code point over a lesson. The first "trigger" step is discarded (`steps.slice(1)`). For each key, `timeToType` for that lesson is the **rounded mean** of its occurrence times (`Math.round(time / count)`). Typos increment `missCount` and **do not** contribute to timing. Per-key times are clamped: below **40 ms** (>300 WPM) or above **12000 ms** (<1 WPM) are rejected as outliers.

### Cross-lesson smoothing (the EMA)

`MutableKeyStats` (`packages/keybr-result/lib/keystats.ts`) holds one exponential-smoothing filter per key, created with `makeFilter(0.1)` — so **alpha = 0.1**. The filter (`packages/keybr-math/lib/filter.ts`) is a textbook EMA: the first sample seeds `value = v`; thereafter `value = alpha*v + (1-alpha)*value`. Each completed lesson appends one new per-key sample (its per-lesson mean), and the key's reported `timeToType` is the filtered value.

Crucially, `bestTimeToType` is the running **minimum of the smoothed (filtered) values**, not of the raw per-lesson means:

```js
this.#bestTimeToType = Math.min(this.#bestTimeToType ?? Infinity, filteredTimeToType);
```

This is why `bestConfidence` (derived from `bestTimeToType`) drives default unlocking — one good smoothed run banks the key.

> This is verified for the open-source frontend; whether the live deployment uses an identical alpha (vs a server-tuned value) is not independently confirmable.

### Learning rate & "lessons remaining" prediction

`LearningRate` (`packages/keybr-lesson/lib/learningrate.ts`) predicts how many more lessons until a key reaches target speed:

1. Take the last **30** samples (`samples.slice(-30)`); optionally trim to the latest unbroken "learning session" (no >1-hour gap, no sustained slowdown — `learningsession.ts`).
2. Fit a **polynomial regression** of speed vs lesson index. Degree: **3 (cubic)** if >20 samples, **2 (quadratic)** if >10, else **1 (linear)**.
3. Compute R² (`certainty`); only report a rate if **certainty ≥ 0.5**.
4. `learningRate` = derivative of the fitted polynomial at the last index (instantaneous WPM-gain-per-lesson).
5. Scan forward `for (let i = 1; i <= 50; i++)` and set `remainingLessons` to the first `i` where predicted speed ≥ target; otherwise it stays NaN (>50 lessons out).

### Overall lesson metrics

For a whole lesson (`packages/keybr-result/lib/result.ts`):

```
speed    = (length / (time/1000)) * 60          // CPM
accuracy = (length - errors) / length
score    = (speed * complexity / (errors+1)) * (length / 50)
```

`complexity` is the number of distinct characters in the histogram (floor 3). A result is only counted toward stats if `length >= 10`, `time >= 1000ms`, `complexity >= 1`, `speed >= 1`, and the histogram has ≥3 distinct characters.

> How errors *quantitatively* couple into a key's confidence is only indirect: typos inflate nothing in `timeToType` (they're excluded from timing and merely counted as misses). So the third-party "≤5 errors to unlock" figure is only weakly corroborated; the precise error→confidence coupling was not traced end-to-end.

### Summary aggregates

Lesson-level summary metrics (avg/min/max/last/delta) are plain cumulative aggregates — **not** EMA-smoothed: `avg = sum/count`, `delta = value - avg`, min/max via `Math.min`/`Math.max` (`packages/keybr-result/lib/summarystats.ts`). Only per-key `timeToType` uses the EMA.

---

## E. The Analysis Page (Profile) — Charts & Metrics

The "Analysis/Statistics" surface is the Profile page (`/profile`), implemented by `ProfilePage.tsx` in `packages/page-profile/lib`, with chart components in `packages/keybr-chart/lib`. The same ordered set renders for your own profile and for a shared `PublicProfilePage`. An "Explain charts / Hide explanations" toggle (`prefs.profile.explain`, default true) shows or hides per-chart descriptions.

The fixed section order:

| # | Section | What it shows |
|---|---|---|
| 1 | All-Time Summary | Time, Lessons, Top/Average speed, Top/Average accuracy |
| 2 | Today Summary | Same metrics, reset daily |
| 3 | Accuracy Streaks | Longest runs above 100/97/95% accuracy thresholds |
| 4 | Histograms (tabs) | Relative Typing Speed + Relative Accuracy (percentile vs all users) |
| 5 | Learning Progress Overview | Per-key confidence heatmap over lessons |
| 6 | Typing Speed | Learning curve with regression trend |
| 7 | Key Typing Speed | Per selected key, with target-speed line + "characters" detail |
| 8 | Key Typing Speed Histogram | Average speed per key |
| 9 | Key Frequency Histogram | Hit / miss / miss-hit-ratio per key |
| 10 | Key Frequency Heatmap | Keyboard colored by hit/miss counts |
| 11 | Practice Calendar | GitHub-style activity calendar |

(`packages/page-profile/lib/ProfilePage.tsx`)

### The learning curve (Typing Speed)

`SpeedChart` plots: X = lesson number; left Y = speed; right Y = accuracy. It scatters three smoothed series — speed, accuracy, and **complexity** (`result.histogram.complexity`, floor 3, i.e. how many distinct keys the lessons used) — and draws a bold **linear-regression** trend line through speed (`linearRegression(vIndex, vSpeed)`). A user-controllable smoothness slider (`SmoothnessRange`, default 0.5, exponential `smooth()`) damps noise. Insight: am I getting faster while accuracy holds as complexity rises? (`packages/keybr-chart/lib/SpeedChart.tsx`)

### Per-key learning heatmap (Learning Progress Overview)

`ProgressOverviewChart`: X = lesson number, Y = one row per letter; each pixel column is colored by that key's `Target.confidence(timeToType)` at that lesson via `confidenceColor` (slow → fast). This is the canonical "keys turn green as you master them" view across your whole history (`packages/keybr-chart/lib/ProgressOverviewChart.tsx`).

### Per-key curve (Key Typing Speed)

`KeySpeedChart`: pick a key (`KeySelector`); X = lesson number, Y = speed for that key, with a scatter + regression curve and a horizontal **target-speed threshold line** (`Target.targetSpeed`). Above it, `KeyDetails` renders the "characters" detail view (the `KeyDetailsChart` extends the X axis by 10 and draws a "Now" marker plus the target line when `bestConfidence < 1`, using `LearningRate` to project the curve forward) (`packages/page-profile/lib/profile/KeySpeedChartSection.tsx`, `packages/keybr-chart/lib/KeyDetailsChart.tsx`).

> The exact metrics inside the `KeyDetails` panel (confidence %, best speed, last speed, etc.) come from `keybr-lesson-ui/KeyDetails`, which was not read line-by-line.

### Per-key histograms and heatmap

- `KeySpeedHistogram`: bars of average speed per key (Y from 0) (`KeySpeedHistogram.tsx`).
- `KeyFrequencyHistogram`: three stacked panels per key — hit count, miss count, and **miss/hit ratio** (the per-key relative error rate, computed as `missCount / hitCount` in `keyusage.ts`) (`KeyFrequencyHistogram.tsx`).
- `KeyFrequencyHeatmap`: overlays the virtual keyboard with two circle-color layers — hit count (`modifier "h"`) and miss count (`modifier "m"`) — so you see which keys you press most and miss most (`KeyFrequencyHeatmap.tsx`).

### The percentile benchmark ("beats X% of all other people")

The Histograms tab group is the explicit "compare to others" feature, and its mechanism matters for anyone rebuilding it:

The benchmark is computed **entirely client-side against a static, baked-in empirical distribution** — there is **no live query** of current users. Two JSON arrays of raw histogram counts are committed into the frontend: `dist_speed.json` (751 integers) and `dist_accuracy.json` (1001 integers), imported at build time (`packages/keybr-chart/lib/dist/`). They were last modified 2024-10-03 and have not changed since — so the reference population is **stale by design** and does not move as live users improve.

Processing (`packages/keybr-chart/lib/dist/dist.ts`):

```js
makeSpeedDistribution    = new Distribution(bucketize(smooth(smooth(smooth(speed, 5), 5), 5), 150));
makeAccuracyDistribution = new Distribution(smooth(smooth(smooth(accuracy, 5), 5), 5));
```

- Both are smoothed **three times** with a centered moving-average window of **5**.
- `bucketize(…, 150)` means **150 buckets** and applies to **speed only** — accuracy is smoothed but **not** bucketized.

The `Distribution` class (`packages/keybr-math/lib/dist.ts`) is an empirical distribution function: it builds a normalized PMF and a running-sum CDF. The percentile is then `distribution.cdf(value)` where `value` is your all-time average (or top) speed/accuracy; accuracy additionally scales the [0,1] value to a histogram index first (`distribution.cdf(distribution.scale(value))`). Rendered text: "Your all time average speed beats {X%} of all other people." A grep of the data path (`dist.ts`, the section components) finds zero `fetch`/`async`/`http` calls — it is built with `useMemo(() => makeSpeedDistribution(), [])`, purely in-browser (`SpeedHistogramSection.tsx`, `AccuracyHistogramSection.tsx`).

### Other sections

- **Accuracy Streaks** (`AccuracyStreaksSection`): longest continuous runs above each threshold, with per-streak lessons, characters, top/avg speed, and start date (`MutableStreakList.findLongest`).
- **Calendar** (`CalendarSection`): a daily-activity calendar colored by effort.

### Two charts that are NOT on the Profile page

`RollingSpeedChart` (intra-lesson speed vs elapsed time, with typo "bumps") and `TimeToTypeHistogram` (per-keystroke speed buckets within one lesson) exist in `keybr-chart` but are **not** imported by `ProfilePage.tsx` — they belong to the post-lesson/typing-test result views, not the long-term statistics page.

### Separate: global High Scores

Independent of the Profile, keybr has a global High Scores leaderboard (`/highscores`, `packages/page-highscores`): a table of the fastest typists over the last few days, ranked by a Score "measured from typing speed, text length, the number of different characters in the text, and the number of errors" (reward speed/length/alphabet, punish errors). Each row links to a public profile (`HighScoresPage.tsx`).

---

## F. Data / Account Model

keybr.com is **local-first** with optional server sync gated on having an account. Three "user" modes are a discriminated union: anonymous (not signed in), named (signed in), and public (viewing someone else's shared profile) (`packages/keybr-result-loader/lib/internal/storage.ts`).

### Where results live

| User | Results storage |
|---|---|
| Anonymous | Browser **IndexedDB** only, database + object store both named `history`, `autoIncrement: true`, results stored as **JSON** (`resultToJson`) |
| Named | Local IndexedDB **plus** server sync |
| Public | Remote read-only (append/clear throw "Disabled") |

(`packages/keybr-result-loader/lib/internal/local.ts`, `storage.ts`)

IndexedDB is used in exactly one place in the repo (the result loader); clearing browser data wipes anonymous progress.

### Where settings live (correction)

> **Verification correction.** Settings are **not** stored in an IndexedDB object store. Client settings use browser **localStorage** under the key `"settings"`: `ObjectStorage` wraps `localStorage` by default and serializes via `JSON.stringify` (`packages/keybr-settings-loader/lib/internal/objectstore.ts`, `storage.ts`). Calling this a local "object store" is misleading — settings never touch IndexedDB.

### Server sync

When signed in, results sync over `/_/sync/data` as binary `application/octet-stream` (GET pulls + decodes via `parseFile`, POST pushes `formatMessage(results)`, DELETE clears) (`packages/keybr-result-loader/lib/internal/remotesync.ts`, `packages/server/lib/app/sync/controller.ts`). On the server, each user's results are appended in chunks (default 100/chunk) to a per-user binary file in the `@keybr/result-io` format (`fileHeader`/`fileChunk`/`parseFile`), located via `DataDir.userStatsFile(userId)` and served as `attachment; filename="stats.data"` (`packages/keybr-result-userdata/lib/userdata.ts`).

**Settings** sync over a **separate** endpoint, `PUT /_/sync/settings`, as **JSON** (server-side per-user JSON file via `SettingsDatabase` at `DataDir.userSettingsFile(userId)`).

> Note the format split: local IndexedDB results are JSON; the server `stats.data` file and the `/_/sync/data` transport are binary.

### Sync resolution: server is source of truth, no merge

This is high-confidence and backed by named unit tests. `ResultStorageOfNamedUser.load()` calls `remote.receive()` first; if it returns any results, those are returned directly and **local is ignored**. Only if remote is empty does it load local, upload it to remote, clear local, and return it — a **one-time migration** of anonymous data on first sign-in. There is no merge or conflict resolution; `receive()` just parses the server file. The repo's `storage.test.ts` includes tests literally named "named user - fetch remote and ignore local data" and "named user - upload local to remote on first sync" (`packages/keybr-result-loader/lib/internal/storage.ts`, `storage.test.ts`).

### What is tracked

Each round produces a `Result` (`packages/keybr-result/lib/result.ts`) with: layout, textType, timeStamp, length, time (ms), errors, speed (CPM), accuracy, complexity, score, and a per-key `histogram`. From these, `KeyStatsMap`/`KeyStats` derive per-letter `samples` — each `KeySample` carries index, timeStamp, hitCount, missCount, raw `timeToType`, and the EMA-smoothed `filteredTimeToType` — plus `timeToType` and `bestTimeToType` (`packages/keybr-result/lib/keystats.ts`).

### Accounts (passwordless)

- **Email:** magic link — "Simple sign-in that does not use passwords... we will send you a login link." The link is temporary and expires within hours (`packages/page-account/lib/EmailLoginForm.tsx`).
- **OAuth:** Google, Microsoft, Facebook (no Apple) (`packages/page-account/lib/OAuthLoginForm.tsx`, `keybr-oauth` adapters).
- **Account management:** "Anonymize me" (hide public name/image), "Sign out," and "Delete account" — deletion removes personally identifiable info (name, e-mail) and is irreversible; typing stats are cleared separately from the profile page (`packages/page-account/lib/AccountSection.tsx`).

Multi-device sync is therefore simply "sign in on each device" — the server `stats.data` + settings files are the shared state; there is no separate cross-device feature.

### Data portability

There is **no polished in-app JSON import/export UI**. What exists: the binary `stats.data` is downloadable (via the `Content-Disposition` header), `DataScript.tsx` embeds your stats as inline JSON in a `<script id="profile-data">` tag (scrapable, not a download button), and a C++ `user-data-tools` package reads/processes the binary stats files. `keybr-keyboard-io/lib/export.ts` exports keyboard *layouts*, not stats.

### Free vs Premium

The **entire** statistics/learning feature set is **free**. Premium status is a single boolean (`readonly premium: boolean` on `NamedUser`, `packages/keybr-pages-shared/lib/types.ts`). The helper `isPremiumUser` is imported in exactly one file — `AccountSection.tsx` — where it only toggles ads-related account messaging. `ProfilePage.tsx` references no premium flag and renders every chart unconditionally.

Premium is a **one-time lifetime Paddle payment** that only:
1. Removes ads,
2. Removes trackers ("complete online privacy"),
3. Speeds page loads ("faster loading times").

The copy states verbatim: "It is a single time payment that provides lifetime access. It is NOT a recurring subscription." The price is fetched dynamically from Paddle (`paddle.PricePreview(priceId)` in `AccountPricePreview.tsx`), so it is region/tax-dependent and not hardcoded.

> The "data export" benefit sometimes attributed to keybr **overstates** reality — no deliberate export feature exists beyond the binary download and inline JSON. And the specific ~US$14 / S$12.88 price figures come only from third-party reviews (**low confidence**); the source confirms no specific amount.

---

## Cross-Cutting Uncertainties

For an implementer, keep these flagged as unverified or production-dependent:

- **Production vs master drift.** Every algorithmic constant here (alpha 0.1, target 175 CPM, model order 4, EMA-based `bestTimeToType`, the 30-sample/R²≥0.5/50-lesson learning-rate window) comes from the open-source `master` branch. The live deployment could use server-tuned or A/B-tested values.
- **Error → confidence coupling.** Typos are counted as misses and excluded from timing; they do not directly inflate `timeToType`. The exact mechanism (if any) by which accuracy gates unlocking beyond this was not traced end-to-end.
- **JS-rendered UI prose.** Exact tooltip/legend/celebration-alert wording could not be quoted — only source class names and message IDs.
- **Binary model encoding.** The numeric quantization of transition frequencies in `model-<lang>.data` was not read.
- **Between-lesson visual flow** (modal vs inline) and the **exact `KeyDetails` panel contents** are medium confidence.
- **Offline/PWA status** (service worker / app manifest) was not verified.
