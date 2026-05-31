# Content modes — design & phased plan

Today typr has exactly one content source: the **Adaptive (Guided)** stream. This
plan adds selectable *content modes* (Words, Numbers, Custom, Quotes, Code…) without
disturbing the adaptive core.

## Architecture (the key idea)

The typing engine is already content-agnostic — `TextInput`, `KeyStatsMap`,
`BigramStatsMap`, the board, and the cursor consume/produce any string and key stats
**by code point**. So we only need a pluggable *source* layer in front of them.

```ts
// One lesson's worth of text, plus optional adaptive targeting metadata.
interface Lesson {
  text: string;
  target: { included: CodePoint[]; focus: CodePoint | null; bigramFocus: [CodePoint, CodePoint] | null } | null;
}

interface ContentSource {
  id: string;            // 'adaptive' | 'words' | 'numbers' | 'custom' | 'quotes' | 'code'
  label: string;
  next(ctx: { stats: KeyStatsMap; bigrams: BigramStatsMap; settings: Settings; rng: () => number }): Lesson;
}
```

- `GuidedLesson` becomes the `adaptive` source (its `LessonPlan` → `Lesson.target`).
- Other sources return `target: null` → the on-screen keyboard hides (or goes neutral)
  and there's no unlock/focus, but **stats still accumulate** for every mode.
- The session hook (`useTypingSession`) holds a `mode` setting and the active source; a small **mode selector** (chips
  above the board, or a Settings row) switches it. Per-mode options live in Settings.

## Sources

| Source | Notes | Effort |
|---|---|---|
| `adaptive` | Existing `GuidedLesson`. | done |
| `words` | Sample the frequency word bank ungated; options: min/max length, frequency tier. | Low |
| `numbers` | Generate digit groups (configurable group size/count); optional Benford-weighted leading digit. | Low |
| `custom` | User pastes text → chunked into lines. Persisted. | Low |
| `quotes` | Bundle a **public-domain** quote/passage corpus; sample or sequential. | Med |
| `code` | Per-language snippets; needs the **symbol keyboard** (see below). | High |

Plus **modifiers** (apply to adaptive/words text, like keybr): `% capitals`,
`% punctuation`. Low effort, broad value (writers, prose).

## What needs real UI work

1. **Symbol/number keyboard.** The on-screen keyboard shows a–z only. Numbers/Code
   need the number row + common symbols. Per-key *stats* already handle them (code
   points); only the *display* is missing.
2. **Mode selector + per-mode settings** (digit count, custom text box, language).
3. **Keyboard visibility** per mode (hide for prose/custom; show for adaptive/words/numbers/code).

## Where this beats keybr

- **Adaptive selection of *real* content.** keybr's Word/Book modes are static; typr can
  pick the word/quote/snippet **richest in your weak keys/bigrams**. (Already prototyped:
  the natural-words path now over-samples your weak transition ~90× — extend the same idea
  to quotes/snippets.)
- **Unified cross-mode analytics.** Per-key & per-transition stats accumulate across every
  mode, so Code practice still improves your letter heatmap and vice-versa. Optionally tag
  results by mode for filtering.

## Phased plan

- **Phase 1 (low effort, high value):** `ContentSource` abstraction + `mode` setting +
  mode selector UI. Ship **Words, Numbers, Custom**. Add **capitals/punctuation modifiers**.
  Keyboard hidden for custom/words-without-letters; shown for adaptive.
- **Phase 2:** **Quotes/prose** corpus (public-domain) + adaptive real-content selection.
  Capitals/punctuation polish.
- **Phase 3:** **Code mode** + the **symbol/number keyboard** + symbol stats in Analysis.

## Data & licensing

- Numbers: generated (no data).
- Quotes: public-domain only (e.g., classic literature, proverbs).
- Code: hand-curated or permissively-licensed snippets (or generate from grammar).
- Word bank: already frequency-ranked (see docs/ATTRIBUTION.md).
