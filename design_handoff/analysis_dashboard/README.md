# Package 04 — Analysis Dashboard

> Read `../ARCHITECTURE.md` first. This package replaces the existing Analysis page.

## Overview
A complete redesign of the **Analysis** view (`/analysis`) into a progress dashboard:
scorecards, a speed-over-time learning curve, accuracy + consistency trends, a per-key
speed heatmap, slow-keys / weak-transition tables, and a GitHub-style practice calendar.

**Design intent:** answer three questions at a glance — *Am I improving?* (curve),
*What's still slow?* (heatmap + tables), *Have I been consistent?* (calendar). Inspired by
keybr's profile and nvzone/typr's stats, but built only from data the engine **already
exposes** — no new tracking except (maybe) one timestamp field (see below).

Visual reference: `prototypes/Analysis Dashboard.html` (Amber default, theme-switchable).
It uses prefixed/inline styles + hand-rolled SVG only so it runs standalone; in the app,
reuse the real components and `app.css` classes.

## Fidelity
High for layout, hierarchy, and the token palette. Charts should use the **existing**
`src/ui` chart components; the prototype's inline SVG is a spec for shape/axes/legend, not
code to copy.

## Where it goes
Replace the contents of the Analysis view — `src/ui/Analysis.tsx` (rendered by the
`view === 'analysis'` branch / the `/analysis` route). Pull all data from
`useTypingSession()`; add a pure `src/core/analytics.ts` for derived aggregates so the math
is unit-testable. Reuse `LineChart`, `BarChart`, `KeyboardHeatmap` from `src/ui/`, and
`confidenceColor` from `src/ui/color.ts`.

## Panels → data source (all from `useTypingSession()`)

| Panel | Source | Notes |
|---|---|---|
| **Scorecards** (best wpm, avg last 10 +Δ, accuracy, time invested, day streak, letters unlocked) | `history`, `plan.included` | best = max wpm; avg10 = mean of last 10; Δ vs prior 10; letters = `plan.included.length`/26 |
| **Speed over time** (net + raw wpm, dashed goal line) | `history` (`wpm`, `rawWpm`), `settings.targetSpeed` | the centerpiece. `LineChart` with two series + a goal rule (extend `LineChart` minimally if it doesn't support a reference line) |
| **Per-key progress** (small-multiples: one card per key — keycap, current wpm, ▲ gain, mini trend sparkline; weakest first) | `history` + `stats` | Readable alternative to multi-line spaghetti. Needs per-key speed *per session*; if history doesn't retain per-key splits, approximate from current `stats` confidence with a smoothed ramp, or start recording a compact per-session per-key wpm going forward. Each sparkline tinted via `confidenceColor`. |
| **Accuracy trend** | `history.accuracy` | `LineChart`, y 90–100 |
| **Per-key speed heatmap** + worst-keys callout | `stats` (KeyStatsMap) | reuse `KeyboardHeatmap`; color via `confidenceColor`; show per-key wpm; dim locked keys (not in `plan.included`) |
| **Slowest transitions** | `bigrams` (BigramStatsMap) | sort ascending by confidence/speed, top 5; render `t → h` with mastery bar |
| **Slowest keys** | `stats` per-key avg ms | sort desc by mean time-to-type, top 5; show delta vs target |
| **Accuracy by key** | `stats` per-key hits/attempts | lowest 5 by % correct |
| **Practice calendar** | `history` timestamps | group by local day → minutes; render week×day grid; compute current streak |

## Daily practice goal (new setting)
The activity panel includes a **Daily goal** control (`10 / 20 / 30 / 60` min). Its
canonical home is **Settings** — wire it to `settings.dailyGoalMinutes` (already in the
settings model; just needs UI) via `updateSettings({ dailyGoalMinutes })`. Mirror the same
control in the Analysis activity panel for quick adjustment. The calendar then highlights
days that met the goal and the streak/goal note reads from it. Add a matching row to the
Settings **Practice** group (segmented control, same pattern as `keyOrder`).

## The one data dependency: lesson timestamps
The calendar + day-streak need each lesson's **completion time** (and ideally duration).
- If `LessonResult` already carries a `timestamp`/`finishedAt` (and a duration or
  char-count to estimate minutes), **derive everything from `history`** — no new storage.
- If not, add a single `timestamp: number` (Date.now()) field where results are recorded
  (`src/core/result.ts` / the hook's commit path). This is an additive, backward-compatible
  change — guard for older saved results without it (treat as undefined → exclude from
  calendar only). **Do not** change or rename existing persisted keys.

## Charts: reuse, extend minimally
- `LineChart` — needs: multiple series, optional filled area, an optional dashed
  **reference line** (goal), sparse point markers. Add props if missing; don't fork.
- `KeyboardHeatmap` — already maps per-key confidence to color; feed it a "speed" accessor
  if it currently only takes confidence.
- KPI sparkline — a tiny inline SVG polyline is fine (see prototype).
- Respect `prefers-reduced-motion`; keep the calm motion language (no bouncy reveals).

## House rules
No new colors (tokens only), no charting/icon libraries, no emoji. Calendar intensity ramp
must mix in **sRGB** (`color-mix(in srgb, var(--accent) N%, var(--panel-2))`) — mixing in
OKLCH takes a hue detour through pink. The keyboard heatmap keeps its OKLCH red→green ramp.

## Files to touch
| Design | Codebase |
|---|---|
| Whole Analysis page | `src/ui/Analysis.tsx` (replace), `src/app.css` |
| Derived aggregates | **new** `src/core/analytics.ts` (pure) + a smoke test |
| Charts | `src/ui/LineChart.tsx`, `src/ui/KeyboardHeatmap.tsx` (extend props only) |
| Lesson timestamp (if absent) | `src/core/result.ts` / the commit path in `useTypingSession` |

## Suggested Claude Code prompt
See the chat message accompanying this package, or reuse the block at the bottom of this
file.

---

```text
Read design_handoff/ARCHITECTURE.md then design_handoff/analysis_dashboard/README.md, and
open prototypes/Analysis Dashboard.html for visual reference. Replace the Analysis page
(src/ui/Analysis.tsx, the /analysis view) with the dashboard shown.

Plan first, don't code yet. Then implement in this order, pausing after each for review:

1. Add a pure src/core/analytics.ts deriving, from useTypingSession data:
   bestWpm, avgLast10 (+ delta vs prior 10), recentAccuracy, lettersUnlocked
   (plan.included.length/26), perKeyMs + slowest keys (from stats), perKeyAccuracy lowest-5,
   slowestBigrams (from bigrams), and dailyMinutes + currentStreak grouped from history
   timestamps. If LessonResult has no timestamp, add a single additive timestamp:number
   field at the commit path and guard older saved results (exclude from calendar only).
   Add a smoke test asserting the aggregates on a seeded history.

   Also surface a daily-goal: add a Settings Practice-group control bound to
   settings.dailyGoalMinutes (10/20/30/60), and mirror it in the Analysis activity panel;
   the calendar marks goal-met days and the streak note reads from it.

2. Build the page in src/ui/Analysis.tsx using existing tokens + app.css classes, in this
   order: scorecards row → speed-over-time chart → per-key progress (small-multiple cards,
   one per key, weakest first) → accuracy trend → per-key heatmap + slowest transitions → slowest keys + accuracy-by-key →
   practice calendar (with the daily-goal control). Match the prototype's layout, spacing,
   and legends. (No "consistency" chart — it was dropped.)

3. Charts: reuse src/ui/LineChart (extend with multi-series + optional dashed goal line +
   sparse markers if missing — don't fork) and src/ui/KeyboardHeatmap (feed per-key speed).
   KPI sparkline can be a small inline SVG. Calendar cells must use
   color-mix(in srgb, var(--accent) N%, var(--panel-2)); keep the keyboard's OKLCH red→green.

No new colors, no chart/icon libraries, no emoji. Respect prefers-reduced-motion. Don't
rename storage keys or components. Show diffs; npm run typecheck && npm run test:smoke &&
npm run dev to verify (use #seed to populate history).
```
