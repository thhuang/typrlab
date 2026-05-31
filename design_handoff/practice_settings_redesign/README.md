# Package 01 — Practice & Settings Redesign

> Read `../ARCHITECTURE.md` first. This package assumes its file map, token system, and
> house rules.

## Overview

A redesign of two screens: the **Practice** view (3 alternative directions) and the
**Settings** view (2 alternative directions). Built on typr's existing tokens and
component vocabulary, so adopting them is mostly **layout/structure** work — not a
re-theme and not an engine change.

**Goal:** make typr's adaptive intelligence more visible and offer a calmer focus mode,
without touching the engine, data model, or token system.

## Fidelity

**High.** Colors, type, spacing, radii, and states are final and pull from the tokens in
`src/theme.css`. Recreate faithfully with the existing `src/app.css` classes. Where a
mock differs from current `app.css`, the mock is the target.

## Prototypes in this package

| File | What |
|---|---|
| `prototypes/Practice & Settings Directions.html` | All 5 mocks on a pan/zoom canvas (drag to reorder, double-click labels, click ⤢ for fullscreen). Shown in **One Dark**. |
| `prototypes/practice-directions.jsx` | `PracticeZen`, `PracticeInstrument`, `PracticeCoach` + helpers `XKeyboard`, `XText`. |
| `prototypes/settings-directions.jsx` | `SettingsTwoPane`, `SettingsSingleColumn`. |
| `prototypes/exploration.css` | Measurement reference. **Map back to `src/app.css`; do not import.** The mocks use prefixed classes (`.x-board`, `.x-key`…) only so they run standalone; the real classes (`.board`, `.key`, `.card`, `.switch`, `.segmented`) already match. |
| `prototypes/typr-tokens.css`, `prototypes/design-canvas.jsx` | Token copy + canvas harness (harness is not part of the product). |

## Recommendation

Ship **Practice · Coach** + **Settings · Two-pane**. Keep **Zen** as an optional focus
toggle and **Instrument** as a future "dense/stats" mode. **Single-column** settings is
the minimal-diff fallback.

---

## PRACTICE — where it goes in code

All three directions replace the **`view === 'practice'`** branch of
`app/TyprApp.tsx` (the `<main className="stage">` block). They reuse `TypingBoard`
(`src/ui/TypingBoard.tsx`) and `Keyboard` (`src/ui/Keyboard.tsx`) unchanged, and read
everything from `useTypingSession()` — no new state.

### A · Zen Focus
Calm flow mode; hide chrome. Full-height flex column, `space-between`.
- Minimal top bar (brand + theme chip + text `settings` link; no view toggle).
- Centered: eyebrow (`guided · drilling th`, mono 12px uppercase `--muted`, `th` in
  `--accent-soft`); the **naked** text line (no panel) at `--board-size`, `--font-mono`,
  `line-height 1.8`, `max-width ~60ch`, char states typed→`--hit` / cursor→box `--accent`
  / untyped→`--untyped`; a thin progress rule (3px, accent gradient); three minimal
  gauges (Speed `--accent`, Accuracy `--hit`, Score `--text`, each with a `▲/▼` delta).
- Bottom: daily-goal bar, centered, `max-width 520px`.
- *Optional:* reveal the keyboard only on demand (a `focusMode` `useState`).

### B · Instrument  (≈ today's layout, refined)
`max-width ~920–960px`, centered, `gap 18px`. Brand + `adaptive` tag + view toggle +
theme chip; an actions row (`Target NN wpm` left, `Skip ⌃→` right); the `.board`
(`--board-size`); the full confidence `Keyboard`; the hint line; then the 8-card stat
strip (`grid-template-columns: repeat(8,1fr)` — Last, Accuracy, Score, Best, Average,
Letters, Lessons, Focus) and the daily-goal bar. Mostly a **polish** pass on the current
practice view's spacing.

### C · Coach  ⟵ recommended
Two columns: `grid-template-columns: 1fr 300px`, `gap 18px`, `max-width 980px`.
- **Left:** `.board` (`--board-size`) + `Keyboard` + a left-aligned continuous-flow hint.
- **Right rail — new `src/ui/CoachRail.tsx`** (3 `--panel` cards, radius `--radius`):
  1. **Now drilling** — the focused bigram as two `--font-mono` 34px glyphs in
     `--accent-soft` joined by `→`; below, a **confidence ring**
     (`conic-gradient(var(--accent) 0% <c>%, var(--line) <c>% 100%)`, 132px, with a 104px
     `--panel` inner circle showing the % over an `of target` label); caption "Your
     slowest transition right now."
  2. **Weakest keys** — 4 rows: key letter (mono/700 `--accent-soft`) · track
     (`--panel-2` + `--line`) with a fill `width = confidence%`, `background =
     confidenceColor(c)` · right-aligned mono % in `--muted`.
  3. **Next unlock** — "**2 keys** from unlocking **k**. Get every active key to target
     speed."

**Data (all already in the hook / plan):** `plan.bigramFocus` & `plan.focus` (drill
target); `stats.bestConfidence(cp, targetSpeed)` / `stats.confidence(...)` for the ring
and weakest-keys list (sort included keys ascending by confidence, take 4); the
"N keys from unlocking" count comes from the `GuidedLesson` inclusion gate in
`src/core/guided.ts`. Render the rail beside the board in the practice branch.

---

## SETTINGS — where it goes in code

Both directions reshape **`src/ui/SettingsView.tsx`** (rendered by the
`view === 'settings'` branch / the `/settings` route). They use the **real settings** and
the existing controls (`.switch`, `.segmented`, `.theme-select`, range, `.danger-btn`)
and call the hook's `updateSettings(patch)` / `clearAll()`. Reuse the existing live
`Preview` board component already in `SettingsView.tsx`.

Settings covered (from `src/core/settings.ts`): `targetSpeed`, `accuracyAware`,
`bigramTargeting`, `naturalWords`, `recoverKeys`, `stopOnError`, `theme`, `font`,
`textSize`, `cursorStyle`, clear-data.

### A · Two-pane with live preview  ⟵ recommended
`grid-template-columns: 210px 1fr`, `gap 22px`, `max-width 980px`. Left: category nav
(Practice / Text appearance / Data) — active item `background: var(--accent-dim)`,
`color: var(--accent)`. Right: a **pinned live preview** board (reuse `Preview`, reacts
to theme/font/size/cursor) above a `fieldset.sgroup` of `.srow` rows for the active
category. Local `useState` for the active category.

### B · Single column, refined  (minimal diff)
Centered `max-width 680px` column; the three existing `fieldset.sgroup` groups
(Practice / Text appearance / Data) with the live `Preview` inside Text appearance.
Structurally today's `SettingsView` — a spacing/typography polish.

---

## Interactions (shared)

- **Continuous flow** — no "next" button; completing the line records the result and
  generates the next (`startNext` / `processKey` in the hook). Keep it.
- **Stop-on-error** — wrong key holds the cursor; the cursor element takes the `err`
  modifier → outline/decoration switches to `--miss`.
- **Motion** — match the app: staggered load `rise` (620ms), 240ms theme crossfade,
  140–160ms hovers, 220ms goal-bar; gate on `prefers-reduced-motion`. The Coach ring may
  animate its conic sweep ≤300ms on update.

## Files to touch

| Design | Codebase |
|---|---|
| Practice layout (all directions) | `app/TyprApp.tsx` (practice branch), `src/app.css` |
| Coach rail | **new** `src/ui/CoachRail.tsx` + slot it into the practice branch |
| Board / cursor | `src/ui/TypingBoard.tsx` (no change; styles in `app.css`) |
| Keyboard heatmap | `src/ui/Keyboard.tsx` (reuse) |
| Stat strip (Instrument) | `src/ui/StatsPanel.tsx` |
| Settings (both) | `src/ui/SettingsView.tsx`, `src/app.css` |
| Tokens | `src/theme.css` (unchanged — reference only) |

## Suggested prompt

> Read `design_handoff/ARCHITECTURE.md` then this README. Implement the **Coach** practice
> direction: add `src/ui/CoachRail.tsx` and render it beside the board in the practice
> branch of `app/TyprApp.tsx`, reading `plan.focus`/`plan.bigramFocus` and `stats` from
> `useTypingSession`, using `confidenceColor` and existing tokens. Then implement the
> **Two-pane** settings layout in `src/ui/SettingsView.tsx`. Match the prototypes in
> `prototypes/`. No new colors or icon libraries; `npm run dev` to compare.
