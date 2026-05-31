# typr — Architecture & Design Conventions (read first)

Shared context for every handoff package. Captures the codebase as of the **Next.js
migration**. If a package's instructions seem to disagree with what you find in the
repo, trust the repo and flag it.

## Stack

- **Next.js 14 (App Router)** · React 18 · TypeScript. (Migrated from Vite — there is
  no `index.html`, `main.tsx`, or `vite.config.ts` anymore.)
- **Local-first**: all data lives in the browser (`localStorage`, IndexedDB). No server
  state. The app is rendered client-only.
- **Self-hosted fonts** via `@fontsource/*` npm packages (no CDN).
- Tooling: ESLint (`.eslintrc.json`, `eslint-config-next`) + Prettier (`.prettierrc.json`).

```bash
npm install
npm run dev        # next dev — http://localhost:3000
npm run build      # next build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
npm run test:smoke # headless checks of the adaptive core
```

## File map

| Path | Role |
|---|---|
| `app/layout.tsx` | Root layout (server). Imports global CSS (`@/theme.css`, `@/app.css`) + `@/fonts-load`; renders `<ThemeScript>` (no-flash theme) and `<AppClient>` plus route `children`. |
| `app/ThemeScript.tsx` | Blocking inline script: reads `localStorage['typr.settings']`, sets `data-theme` (**default `paper`**) + `--board-size` on `<html>` before first paint. |
| `app/AppClient.tsx` | `dynamic(() => import('./TyprApp'), { ssr: false })`. Lives in the persistent layout so engine state survives navigation between routes. |
| `app/TyprApp.tsx` | The app shell. Derives the active view from `usePathname()`, renders the top bar + nav (`router.push`), and the Practice / Analysis / Settings views. Consumes `useTypingSession()`. |
| `app/page.tsx`, `app/analysis/page.tsx`, `app/settings/page.tsx` | **Route shells** — each returns `null`. The layout's `AppClient` paints the view based on the pathname; these just register the routes. |
| `src/hooks/useTypingSession.ts` | **The single source of app state & logic** — engine, per-key (`KeyStatsMap`) + per-transition (`BigramStatsMap`) stats, lesson `plan`, persistence, keystroke handling, settings. See its API below. |
| `src/ui/*.tsx` | Presentational components: `TypingBoard`, `Keyboard`, `StatsPanel`, `Analysis`, `SettingsView`, charts (`LineChart`, `BarChart`, `HeatmapChart`, `KeyboardHeatmap`). |
| `src/ui/fonts.ts` | Typing-font registry (`FONTS`, `fontStack(id)`) applied via `--font-board`. |
| `src/ui/themes.ts` | Theme registry (`THEMES`, `DARK_THEMES`, `LIGHT_THEMES`). |
| `src/ui/color.ts` | `confidenceColor(c)` → the OKLCH red→green mix. Reuse it for any confidence UI. |
| `src/core/*` | Engine: `guided`, `phonetic`, `keyStats`, `bigramStats`, `learning`, `target`, `textInput`, `result`, `settings`, `persist`, `words`, `types`. |
| `src/theme.css` | **Generated** design tokens — `:root` + a `[data-theme='…']` block per theme. Do not edit by hand; regenerate via `scripts/gen-themes.mjs`. |
| `src/app.css` | All component styles (class-based). |
| `src/fonts-load.ts` | Imports each `@fontsource` face (Latin subset) + bundled Meslo (`src/meslo.css`, `public/fonts/meslo-lg.woff2`). |
| `scripts/gen-themes.mjs` | Palette → OKLCH token generator → writes `src/theme.css`. |

Path alias: **`@/` → `src/`**.

## Adding a screen or view

Two shapes, depending on whether it's a new top-level destination:
- **New view on an existing route or a sub-mode** → add markup to `app/TyprApp.tsx`
  (and a presentational component under `src/ui/`).
- **New route** (`/foo`) → add `app/foo/page.tsx` returning `null`, then extend the
  `view` derivation + `PATHS` map in `TyprApp.tsx` and render the view there. The view
  paints from the persistent layout, so engine state persists across navigation.

Keep route components thin; put logic in the hook, visuals in `src/ui`.

## State: `useTypingSession()`

Consume this hook — **don't introduce new global state.** It returns:

```ts
{
  settings, history, plan, position, hasError, last,
  stats,      // KeyStatsMap — live per-key confidence (stats.bestConfidence / confidence)
  bigrams,    // BigramStatsMap — slowest transitions
  startNext, processKey, updateSettings, clearAll, exportData, importData,
}
```

`plan` carries `text`, `included` (unlocked code points), `focus` (weakest key), and
`bigramFocus` (weakest transition) — i.e. everything a "Coach"-style surface needs is
already computed. Local UI state (a settings tab, a focus-mode toggle) is fine with
`useState`.

## Theming & tokens

- Apply a theme by setting `data-theme="<id>"` on `<html>` (the hook does this on
  `settings.theme` change; `ThemeScript` does it pre-paint). `:root` with no attribute is
  the base theme.
- **Never hardcode hex.** Use the CSS variables in `theme.css`: surfaces (`--bg`,
  `--panel`/`--panel-2`, `--line`/`--line-2`, `--key-edge`), text (`--text`, `--muted`,
  `--untyped`), accent (`--accent`, `--accent-soft`, `--accent-dim`, `--accent-line`,
  `--on-accent`), feedback (`--hit`, `--miss`, `--fast-key-color`/`--slow-key-color`,
  `--on-confidence`), effects (`--glow-1/2`, `--grain-opacity`), `--radius` (14px).
- Confidence color (keys, bars, rings): `color-mix(in oklch, var(--fast-key-color) <c*100>%, var(--slow-key-color))` — or just call `confidenceColor(c)` from `src/ui/color.ts`.
- Board font + size come from `--font-board` and `--board-size` (set by the hook).
- `gen-themes.mjs` has a `def: true` flag marking which theme becomes `:root`.

## Styling

Class-based, in `src/app.css`. Reuse the existing vocabulary rather than inventing
classes: `.app`, `.topbar`, `.brand`, `.viewtoggle`, `.board`, `.ch`/`.cursor-*`,
`.keyboard`/`.key`, `.card`, `.stats`, `.goalbar`, `.acard`, `.sgroup`/`.srow`,
`.switch`, `.segmented`, `.theme-select`, `.danger-btn`. Spacing rhythm: gaps 10–24px,
card padding 12–18px, radius 12px (cards) / 14px (panels) / 18px (board).

## Dev preview hooks (handy for screenshots & QA)

In development, URL hash hooks (in `useTypingSession`) let you force state without
clicking through:
- `#seed` — seed demo history (if none saved)
- `#theme=one-dark` · `#font=jetbrains-mono` · `#cursor=box` — preset settings

e.g. `http://localhost:3000/#seed&theme=one-dark`.

## House rules

- **No new icon libraries.** Text affordances only (`_`, `→`, `▲/▼`, `⌃→`) and CSS shapes.
- **No italic on the practice board** (hurts dyslexic readers); roman only.
- For monospace board fonts, **disable coding ligatures** and enable a slashed zero:
  `font-variant-ligatures: none; font-feature-settings: "liga" 0, "calt" 0, "zero" 1;`.
- Respect `prefers-reduced-motion` (the app already gates its load animation on it).
- Don't widen letter-spacing as a "readability" feature (evidence says it hurts).
