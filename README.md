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

### Implemented so far

- Guided lessons over a dynamically expanding letter set (starts at `etaoin`).
- Stop-on-error typing with per-keystroke timing and outlier clamping.
- Adaptive unlocking gated on best/live confidence (`recover keys` toggle).
- Phonetic pseudo-words + natural-words mode; weakest key over-sampled.
- Live keyboard heatmap, post-lesson gauges, daily-goal bar, persistent history.

### Next ("better than keybr")

- A full analysis page (learning curve, per-key learning heatmap, speed histogram).
- Larger/real phonetic models per language; bigram-aware weak-spot targeting.
- Code/numbers/punctuation modes; richer post-lesson insight ("drill this next").

## Core concepts (planned)

| Piece | What it does |
| --- | --- |
| Phonetic generator | Produces pronounceable pseudo-words from a per-language n-gram model, weighted toward currently-targeted keys. |
| Adaptive engine | Unlocks new keys as you reach a target speed; selects which keys to emphasize based on per-key stats and confidence. |
| Per-key stats model | Smoothed (decaying) per-key speed & accuracy, with sample-count confidence. |
| Analysis | Learning curve over time, keyboard heatmap, key-speed histogram, error breakdowns. |

## License

TBD.
