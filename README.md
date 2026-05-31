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

🚧 Early scaffolding. Stack and architecture are being decided from a deep technical study of how keybr works (practice flow, phonetic text generation, the adaptive unlock + target-speed mechanic, the per-key speed model, and the analysis charts). Build notes to follow.

## Core concepts (planned)

| Piece | What it does |
| --- | --- |
| Phonetic generator | Produces pronounceable pseudo-words from a per-language n-gram model, weighted toward currently-targeted keys. |
| Adaptive engine | Unlocks new keys as you reach a target speed; selects which keys to emphasize based on per-key stats and confidence. |
| Per-key stats model | Smoothed (decaying) per-key speed & accuracy, with sample-count confidence. |
| Analysis | Learning curve over time, keyboard heatmap, key-speed histogram, error breakdowns. |

## License

TBD.
