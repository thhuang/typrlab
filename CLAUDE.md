# typrlab — working agreement

Adaptive typing trainer. **Next.js 14** (App Router) · TypeScript (strict) · React 18 ·
**client-only / local-first** (state in `localStorage`, no backend, no API routes).
Ships as a **fully static export** (`output: 'export'` in `next.config.mjs` → `./out`).
Repo `thhuang/typrlab`; live at **https://typrlab.com** (Cloudflare Pages project `typrlab`).

## Git workflow (always)

- **Never push to `main`.** Branch → commit → PR → self-merge → sync:
  ```
  git checkout -b <branch>
  # …changes…
  git commit            # trailer below
  gh pr create
  gh pr merge --merge --delete-branch
  git checkout main && git pull --ff-only
  ```
- Commit messages **end with**: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- PR bodies **end with**: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## Verify before every PR (all must pass)

```
npm run typecheck     # tsc --noEmit (strict)
npm run lint          # next lint
npm run format:check  # prettier --check .
npm run test:smoke    # tsx scripts/smoke.ts — headless adaptive-core checks
npm run build         # next build (static export)
```

CI (`.github/workflows/ci.yml`) runs the same set on PRs and pushes to `main`.

## Deploy (after merge to `main`)

```
npm run build                                              # static export → ./out
npx wrangler pages deploy out --project-name=typrlab --branch=main
```

One-time auth: `npx wrangler login` (Cloudflare OAuth). `typrlab.com` is already attached
to the Pages project (apex). The `*.pages.dev` preview URL prints on deploy.

## Data & storage — do not break

- Keys: `typrlab.settings` / `typrlab.history`, with a one-time forward migration from the
  pre-rebrand `typr.*` keys (`readMigrated` in `src/core/persist.ts`).
- **Never rename or remove storage keys without a migration** — it wipes users' data.
  Per-key stats persist by code point.

## Defaults & brand

- First-run theme is **scheme-aware**: Amber (OS dark) / Paper (OS light) via
  `defaultTheme()` in `src/core/settings.ts` + the no-flash `app/ThemeScript.tsx`. A saved
  theme always wins.
- `app/icon.svg` / `apple-icon.png` are fixed-color brand marks (favicons can't read the
  in-app theme) — don't make them theme-reactive.

## Gotchas

- After moving/renaming the repo dir: `rm -rf node_modules .next out && npm ci` before
  building — stale `node_modules` cause a `/_not-found` build error.
- Headless-Chrome screenshots/DOM dumps orphan — wrap with `timeout` and clean up with
  `pkill -f 'Chrome.*--headless'`.
- Shell is **zsh + noclobber**: use `>|` to overwrite an existing file; unquoted vars don't
  word-split (use `find -exec` or `${=var}`).
- `next build` clobbers `.next` and breaks a running `next dev` — restart dev clean.
- Pushing `.github/workflows/*` needs the gh **`workflow`** OAuth scope:
  `gh auth refresh -h github.com -s workflow`.
