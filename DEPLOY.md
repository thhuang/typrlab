# Deploying typrlab

typrlab is a **fully static, client-only** app — all state lives in the browser
(`localStorage`), there is no backend, no API routes, no environment variables or
secrets. `next build` emits a static site to `./out/` (configured via
`output: 'export'` in `next.config.mjs`), so it hosts on any static CDN.

## Build

```bash
npm ci
npm run build      # writes ./out  (index.html, analysis.html, settings.html, 404.html, _next/…)
```

To preview the exported site locally:

```bash
npx serve out      # or: python3 -m http.server -d out 8000
```

## Cloudflare Pages (recommended)

Pairs with Cloudflare Registrar (where `typrlab.com` is registered), so the custom
domain is one click with no manual DNS records.

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git**, and
   pick the `typr` repo.
2. **Build settings:**
   - Framework preset: **Next.js (Static HTML Export)** _(or "None" — the values below are what matter)_
   - Build command: `npm run build`
   - Build output directory: `out`
   - Root directory: `/`
3. **Environment variables:** add `NODE_VERSION` = `20` (matches local; avoids an old
   default Node). Nothing else — the app needs no secrets.
4. **Save and Deploy.** Each push to `main` ships to production; every PR gets a
   preview URL automatically.
5. **Custom domain:** Pages project → **Custom domains → Set up a domain** →
   `typrlab.com` (and `www.typrlab.com` if you want it). Because the domain lives in
   the same Cloudflare account, the CNAME is created for you and HTTPS is automatic.

### Routing note

Static export writes `analysis.html` / `settings.html`; Cloudflare Pages serves them
at the clean paths `/analysis` and `/settings`, and in-app navigation is client-side
(`router.push`), so deep links and refreshes resolve correctly. `404.html` is the
not-found page.

## Other static hosts (all work the same way)

| Host             | Build command   | Output dir                                    |
| ---------------- | --------------- | --------------------------------------------- |
| **Vercel**       | `npm run build` | auto-detected (`out`)                         |
| **Netlify**      | `npm run build` | `out`                                         |
| **GitHub Pages** | `npm run build` | publish `out/` (e.g. via an Actions workflow) |

For GitHub Pages on a project path (not a custom domain), you'd also set `basePath` /
`assetPrefix` in `next.config.mjs`; not needed for a root custom domain like
`typrlab.com`.
