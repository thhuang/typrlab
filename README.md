# typr

An **adaptive typing trainer** that figures out exactly what's slowing you down —
key by key, _transition by transition_ — and drills it, so practice time goes
where it actually moves the needle.

For **anyone who types a lot** — students, writers, content creators, developers,
and other professionals — not just programmers. That's why typr ships polished
**light _and_ dark** themes (research shows the best choice depends on your
environment and eyes), including a warm sepia **Paper** theme for long writing
sessions.

typr generates practice text on the fly from the letters you've unlocked, weighted
toward your weak spots. It expands your alphabet only when you're both fast **and**
accurate, tracks per-key and per-transition timing, and shows you an honest,
actionable picture of what to work on next.

## Status

🟢 **Runnable.** **Next.js 14 (App Router) + TypeScript**, local-first (your data
stays in your browser). Real, deep-linkable routes: `/`, `/analysis`, `/settings`.

```bash
npm install
npm run dev          # http://localhost:3000 — just start typing
npm run test:smoke   # headless checks of the adaptive core
npm run typecheck    # tsc (strict)
npm run lint         # ESLint
npm run build        # production build
```

## Features

### Adaptive practice

- Guided lessons over a dynamically expanding letter set (starts with the most
  common letters and grows as you improve).
- Stop-on-error typing with precise per-keystroke timing and outlier rejection.
- **Accuracy-aware unlocking** — a key must be typed fast _and_ accurately before
  it counts toward unlocking the next letter.
- **Bigram-aware targeting** — finds the slowest _transitions_ (digraphs like
  `th`, `er`) hiding inside otherwise-fine per-key averages, and drills them.
- Phonetic pseudo-words plus a real-word mode.
- Calm, configurable typing cursor — **box / underline / bar / reverse** — and a
  theme-aware confidence ramp (each theme's own red→green, mixed in OKLCH).
- **Adjustable text size** (the evidence-backed lever for reading performance) and a
  **typing-font picker** — 9 **self-hosted** fonts (no CDN), three per category:
  monospace (JetBrains Mono, Cascadia Code, Source Code Pro), sans (default —
  **Atkinson Hyperlegible**, an accessibility-first legible face), and serif.
  Typeface is largely _preference_ — research shows it barely affects reading speed;
  size and personal fit matter more
  (see [`docs/font-research.md`](docs/font-research.md)).

### Analysis

- Learning curve (speed over time) with trend.
- **Per-key learning heatmap** — every key's confidence over your whole history.
- **Keys to drill** — weakest-first table with speed, accuracy, confidence, and a
  projected _lessons-to-target_ estimate per key.
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

## Tech & structure

Next.js (App Router) · TypeScript (strict) · ESLint + Prettier · **self-hosted
fonts** (no CDN). The local-first app renders client-side (`ssr: false`), so future
SEO/marketing pages and sync/payments **API routes drop in as sibling routes** — no
rewrite needed.

- `app/` — routes (`/`, `/analysis`, `/settings`) + shell (layout, no-flash theme script)
- `src/core/` — framework-agnostic domain: typing engine, per-key & per-transition
  stats, phonetic model, adaptive lesson generation
- `src/ui/` — React components (board, keyboard, charts, settings)
- `src/hooks/` — `useTypingSession` (all stateful logic, kept out of the view)
- `scripts/` — generators (`gen-themes`, `gen-words`) + a headless smoke test

## Roadmap

- Content modes: code, numbers, punctuation, custom text, quotes.
- A custom theme builder; optional auto light/dark by time of day.
- Larger / real phonetic models per language; responsive / mobile polish.
- Optional accounts + cross-device sync; SEO / marketing pages.
- CI (typecheck / lint / build / smoke) once the `workflow` OAuth scope is granted.

## Acknowledgements

typr's adaptive approach was informed by studying **keybr.com**
([source](https://github.com/aradzie/keybr.com), AGPL-3.0) — an excellent
open-source typing trainer. typr is an independent, from-scratch implementation
with its own design and improvements; no keybr code was used. Detailed study
notes: [`docs/keybr-explainer.md`](docs/keybr-explainer.md). See
[`docs/ATTRIBUTION.md`](docs/ATTRIBUTION.md).

## License

Proprietary — all rights reserved. See [LICENSE](LICENSE).
