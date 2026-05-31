# typr

An **adaptive typing trainer** that figures out exactly what's slowing you down —
key by key, *transition by transition* — and drills it, so practice time goes
where it actually moves the needle.

For **anyone who types a lot** — students, writers, content creators, developers,
and other professionals — not just programmers. That's why typr ships polished
**light *and* dark** themes (research shows the best choice depends on your
environment and eyes), including a warm sepia **Paper** theme for long writing
sessions.

typr generates practice text on the fly from the letters you've unlocked, weighted
toward your weak spots. It expands your alphabet only when you're both fast **and**
accurate, tracks per-key and per-transition timing, and shows you an honest,
actionable picture of what to work on next.

## Status

🟢 **Runnable.** Stack: **React + TypeScript + Vite**, local-first (your data
stays in your browser).

```bash
npm install
npm run dev          # http://localhost:5173 — just start typing
npm run test:smoke   # headless checks of the adaptive core
npm run build        # typecheck + production build
```

## Features

### Adaptive practice
- Guided lessons over a dynamically expanding letter set (starts with the most
  common letters and grows as you improve).
- Stop-on-error typing with precise per-keystroke timing and outlier rejection.
- **Accuracy-aware unlocking** — a key must be typed fast *and* accurately before
  it counts toward unlocking the next letter.
- **Bigram-aware targeting** — finds the slowest *transitions* (digraphs like
  `th`, `er`) hiding inside otherwise-fine per-key averages, and drills them.
- Phonetic pseudo-words plus a real-word mode.
- Calm, configurable typing cursor — **box / underline / bar / reverse** — and a
  theme-aware confidence ramp (each theme's own red→green, mixed in OKLCH).

### Analysis
- Learning curve (speed over time) with trend.
- **Per-key learning heatmap** — every key's confidence over your whole history.
- **Keys to drill** — weakest-first table with speed, accuracy, confidence, and a
  projected *lessons-to-target* estimate per key.
- **Transitions to drill** — your slowest digraphs.

### Themes
- **10 presets — 6 dark + 4 light** — chosen for a broad audience: dark dev
  favorites (Dracula, Tokyo Night, Nord, Catppuccin Mocha, One Dark) and
  reading/writing-friendly lights (a warm **Paper** sepia, Solarized Light,
  GitHub Light, Catppuccin Latte), plus typr's default **Amber**.
- Palettes are defined as **OKLCH** design tokens (perceptually uniform),
  generated from each project's canonical colors by `scripts/gen-themes.mjs`.
- Your choice persists locally.

### Your data
- Local-first. Full **JSON export / import** of your history and settings.

## Roadmap

- More themes + a custom theme builder; optional auto light/dark by time of day.
- Self-hosted fonts for full offline use; responsive/mobile polish.
- Larger / real phonetic models per language.
- Code, numbers, and punctuation practice modes.
- Optional accounts + cross-device sync.

## Acknowledgements

typr's adaptive approach was informed by studying **keybr.com**
([source](https://github.com/aradzie/keybr.com), AGPL-3.0) — an excellent
open-source typing trainer. typr is an independent, from-scratch implementation
with its own design and improvements; no keybr code was used. Detailed study
notes: [`docs/keybr-explainer.md`](docs/keybr-explainer.md). See
[`docs/ATTRIBUTION.md`](docs/ATTRIBUTION.md).

## License

Proprietary — all rights reserved. See [LICENSE](LICENSE).
