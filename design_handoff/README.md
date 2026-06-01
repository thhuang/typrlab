# typr — Design Handoff

This folder is the bridge between design (HTML prototypes + the design system) and
implementation (the typr codebase, via Claude Code in your terminal). It's built to
**grow**: shared context lives at the top level, and each design initiative is its own
self-contained package below. Expect more packages over time.

## How to use this with Claude Code

1. Unzip this `design_handoff/` folder into the **root of your typr repo** (next to
   `package.json`) → it sits at `typr/design_handoff/`.
2. From the repo, run `claude`.
3. Point it at a package, e.g.:
   > Read `design_handoff/ARCHITECTURE.md`, then `design_handoff/practice_settings_redesign/README.md`.
   > Implement the **Coach** practice direction and the **Two-pane** settings direction in our
   > Next.js codebase, reusing existing components, the `useTypingSession` hook, and the
   > `theme.css` tokens. Open the prototype HTML for visual reference. Don't add new colors or
   > icon libraries.
4. Review file-by-file, then `npm run dev` and compare against the prototypes.

## Contents

| Path | What it is |
|---|---|
| `ARCHITECTURE.md` | **Read first.** The current codebase map (Next.js App Router), the token system, styling/theming/font conventions, and dev-preview hooks. Every package assumes this. |
| `shared/typr-tokens.css` | Portable copy of the generated theme tokens — the exact `:root` + `[data-theme]` blocks the product ships. |
| `shared/Color & Theme System.html` | Interactive token reference (all 10 themes, live switcher) for visual grounding. |
| `practice_settings_redesign/` | **Package 01 — shipped.** Refreshed Practice + Settings redesign (3 practice directions, 2 settings directions) with Next.js-specific integration steps. |

## Packages & status

| # | Package | Status | Summary |
|---|---|---|---|
| 01 | `practice_settings_redesign` | ✅ Shipped | All five directions live: **Coach** rail + **Two-pane** settings (PR #17), plus the **Zen** focus toggle (#21), **Instrument** layout (#22), and the **Single-column** settings fallback (#24). |
| 02 | Typography / font shelf | ✅ Shipped | Curated 9-font shelf, ≥3 per category (PR #26); default settled on **Atkinson Hyperlegible** (#26–#28). |
| — | Post-ship hardening | ✅ Shipped | Adversarial QA review (15 confirmed findings) hardened the shipped packages: accessibility on Settings / Coach rail / nav (`role="group"`, `aria-pressed`, `aria-current`, a visually-hidden `<h1>`, heading promotion), theme-token fixes for affordances that vanished on the light palettes, content-mode UI consistency (mode-aware Zen eyebrow + brand tag, adaptive-only Target pill), and the font-default fallback (PRs #32–#33). |

## Conventions for every handoff

- These HTML/JSX files are **design references**, not production code — recreate them in
  the codebase's own patterns (see `ARCHITECTURE.md`), don't paste them in.
- **Fidelity is high** unless a package says otherwise: colors, type, spacing, radii, and
  states are final and pull from existing tokens.
- **No new colors, no icon libraries.** typr uses CSS-variable tokens and text affordances
  (`_`, `→`, `▲/▼`, `⌃→`) only.
- Each package's README is self-sufficient given `ARCHITECTURE.md`.
