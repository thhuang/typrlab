# Package — Branding: typrlab icon + rename

> Read `../ARCHITECTURE.md` first (Next.js App Router layout).

## Overview
The product is rebranding **typr → typrlab** (domain `typrlab.com`). This package
delivers the app icon / favicon set and the wordmark spec, and lists the rename edits.

## The mark
A **block‑cursor**: a solid amber rounded square with a knocked‑out I‑beam caret on a
near‑black tile — the typing cursor itself, reusing the brand's existing caret/keycap
DNA. Chosen because it stays crisp from 512px down to a 16px favicon. Fixed brand colors
(amber `#ffb000` on slate `#14171d`) so the icon is consistent regardless of the in‑app
theme. (A `keycap` alternative is included; see `assets/icon-keycap.svg`.)

Visual reference: open `Logo Lab.html` (theme‑switchable; shows all directions + favicon
proofs).

## Assets in this package → where they go (Next.js App Router conventions)

| File | Put it at | Purpose |
|---|---|---|
| `assets/icon.svg` | `app/icon.svg` | Next auto‑generates the favicon from this — **no `.ico` needed**. Delete any old `favicon.ico`/`favicon` so Next's metadata wins. |
| `assets/apple-icon.png` (180²) | `app/apple-icon.png` | Apple touch icon (Next serves it automatically). |
| `assets/logo512.png`, `logo192.png` | `public/` | PWA manifest / Open‑Graph. Reference from a manifest or `metadata.openGraph` if/when added. |
| `assets/icon-keycap.svg` | — | Alternative app‑icon direction; swap into `app/icon.svg` if you prefer the keycap. |
| `assets/madeby-thhuang.png` | `public/madeby-thhuang.png` | Your portfolio mark, used only as a small “made by” credit (NOT the product icon). |

Next.js picks up `app/icon.svg` and `app/apple-icon.png` by file convention — once they
exist, remove any hardcoded `<link rel="icon">` so they don't conflict.

## Wordmark (in‑app markup, not an asset)
Recommended: **`typr_lab`** — the caret blinking *between* the halves. Update the
`.brand` markup (currently `typr_` in `app/TyprApp.tsx`, and the Zen header in
`src/ui/ZenView.tsx`):

```tsx
<div className="brand">
  typr<span className="caret">_</span>lab
  <span className="tag">adaptive</span>
</div>
```
`.brand .caret` already renders the mono accent caret + can keep its blink. If you want
"lab" muted, wrap it: `typr<span className="caret">_</span><span className="brand-sub">lab</span>`
and add `.brand-sub{color:var(--muted)}` in `app.css`.

## Rename checklist: typr → typrlab
- `app/layout.tsx` — `metadata.title` / `description` (e.g. "typrlab — adaptive typing trainer").
- `app/TyprApp.tsx` + `src/ui/ZenView.tsx` — the `.brand` markup (wordmark above).
- `package.json` — `name` → `typrlab` (optional).
- `README.md` / docs — product name references (keep the engine/algorithm prose).
- Web manifest (if present/added) — `name`, `short_name`, icons → the `public/logo*.png`.
- Do **not** rename component files (`TyprApp.tsx`) or storage keys (`typr.settings`,
  `typr.history`) — renaming keys would wipe users' local data. Brand string only.

## “Made by thhuang” credit
Keeps your house identity present without letting it become the product icon. Place a
small, muted credit at the **bottom of the Settings view** (after the Data group in
`src/ui/SettingsView.tsx`) — unobtrusive but discoverable:

```tsx
<a className="madeby" href="https://thhuang.github.io" target="_blank" rel="noopener noreferrer">
  <img src="/madeby-thhuang.png" alt="" width={22} height={22} />
  <span>Made by thhuang</span>
</a>
```
```css
.madeby { display: inline-flex; align-items: center; gap: 8px; margin: 8px 2px 0;
  color: var(--muted); font-size: 12.5px; text-decoration: none; opacity: .85;
  transition: opacity 140ms ease; }
.madeby:hover { opacity: 1; color: var(--text); }
.madeby img { border-radius: 50%; display: block; }
```
Keep it to this one place (or a global footer if you add one). Don't use the portfolio
mark in `app/icon.svg`, the tab favicon, or the top‑bar `.brand` — those stay the typrlab
block‑cursor mark.

## Suggested Claude Code prompt

> Read `design_handoff/ARCHITECTURE.md` then `design_handoff/branding/README.md`. We're
> rebranding typr → typrlab. Do it in two steps, pausing after each:
> 1. **Icons:** copy `design_handoff/branding/assets/icon.svg` to `app/icon.svg`,
>    `apple-icon.png` to `app/apple-icon.png`, and `logo512.png`/`logo192.png` to
>    `public/`. Remove any existing favicon/`<link rel="icon">` so Next's file‑convention
>    icons take over. Confirm the tab favicon updates.
> 2. **Wordmark + strings:** change the `.brand` markup to `typr_lab` in `app/TyprApp.tsx`
>    and `src/ui/ZenView.tsx`; update `metadata` in `app/layout.tsx` and the product name
>    in `README.md`/`package.json`. Do NOT touch localStorage keys (`typr.settings`,
>    `typr.history`) or component filenames. Show diffs.
> 3. **Credit:** copy `branding/assets/madeby-thhuang.png` to `public/`, then add the
>    “Made by thhuang” credit (markup + CSS above) at the bottom of the Settings view in
>    `src/ui/SettingsView.tsx`. Do not use this mark anywhere else.

## Notes
- SVGs are plain geometry (rounded rects) — safe to edit; the amber/slate hexes are the
  only colors. To recolor the brand, change `#ffb000` (mark) and `#14171d` (tile).
- If you later add a PWA manifest, point its icons at `public/logo512.png` / `logo192.png`.
