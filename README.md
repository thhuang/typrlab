# typr

An **adaptive typing trainer** — inspired by [keybr.com](https://www.keybr.com/), built to be better.

typr generates targeted practice on the fly, tracks your performance per key, and adapts what it drills based on where you're actually slow — so practice time goes where it matters instead of retyping text you already type well.

## Vision

keybr proved the model: don't make people copy random books — generate *pronounceable pseudo-words* from a phonetic n-gram model, unlock keys progressively as you hit a target speed, and bias each lesson toward your weakest keys. typr keeps that proven core and aims to beat it on:

- **Smarter adaptation** — richer per-key/per-bigram modeling, confidence-aware key selection, and faster convergence on weak spots.
- **Deeper analysis** — clearer learning curves, a per-key heatmap, error/latency breakdowns, and actionable "drill this next" guidance.
- **Better practice UX** — responsive feedback, configurable content (pseudo-words, real words, code, punctuation/numbers), and frictionless flow.
- **Local-first & portable** — your data is yours; works offline, syncs when you want it to.

## Status

🟢 **Runnable MVP.** Stack: **React + TypeScript + Vite**, local-first (`localStorage`). The adaptive core is implemented and verified — the `timeToType`/`confidence` model, per-key EMA (α=0.1), the confidence-gated letter-unlock rule with weakest-key focus, an n-gram phonetic generator, and a live per-key confidence keyboard.

```bash
npm install
npm run dev          # http://localhost:5173 — just start typing
npm run test:smoke   # headless checks of the adaptive core
npm run build        # typecheck + production build
```

The deep technical study this is built from lives in [`docs/keybr-explainer.md`](docs/keybr-explainer.md) and [`BUILD_NOTES.md`](BUILD_NOTES.md).

### Implemented (keybr baseline)

- Guided lessons over a dynamically expanding letter set (starts at `etaoin`).
- Stop-on-error typing with per-keystroke timing and outlier clamping.
- Adaptive unlocking gated on best/live confidence (`recover keys` toggle).
- Phonetic pseudo-words + natural-words mode; weakest key over-sampled.
- Live keyboard heatmap, post-lesson gauges, daily-goal bar, persistent history.

### Better than keybr (shipped)

- **Accuracy-aware unlocking** — keybr's confidence is speed-only, so a key typed
  fast but sloppily unlocks the next letter prematurely (typos are excluded from
  its timing). typr folds accuracy into confidence, so a key must be fast **and**
  accurate to bank/unlock. Toggle: `accuracy-aware` (default on).
- **Actionable Analysis view** — instead of keybr's stale, baked-in "you beat X%"
  percentile, typr shows a learning curve plus a weakest-first **keys-to-drill**
  table with per-key speed, accuracy, confidence, and **projected lessons-to-target**.
- **Bigram-aware targeting** — keybr only models single keys, so a slow
  *transition* (a same-finger digraph like `ed`, or `th`/`er`) hides inside an
  otherwise-fine per-key average. typr measures per-transition timing, finds the
  weakest digraph among your unlocked letters, and drills it (seeds + boosts that
  transition in generated text). Surfaced as a "Transitions to drill" table.
  Toggle: `bigram targeting` (default on).
- **Data export / import** — full JSON portability of your history + settings,
  which keybr does not offer.

### Next

- Per-key learning heatmap + key-speed histogram in the Analysis view.
- Larger/real phonetic models per language.
- Code / numbers / punctuation modes.

## Core concepts (planned)

| Piece | What it does |
| --- | --- |
| Phonetic generator | Produces pronounceable pseudo-words from a per-language n-gram model, weighted toward currently-targeted keys. |
| Adaptive engine | Unlocks new keys as you reach a target speed; selects which keys to emphasize based on per-key stats and confidence. |
| Per-key stats model | Smoothed (decaying) per-key speed & accuracy, with sample-count confidence. |
| Analysis | Learning curve over time, keyboard heatmap, key-speed histogram, error breakdowns. |

## License

TBD.
