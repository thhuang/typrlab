# Cross-device sync — options & design comparison

> Decision doc. typrlab is **local-first** (state in `localStorage`: `typrlab.settings` +
> `typrlab.history`, a JSON `{version,settings,history}` blob, ≤ a few MB) and ships as a
> **fully static export** on Cloudflare Pages. Sync is **opt-in**; local stays the source of
> truth. Data is **single-user**, so conflict resolution is simple: **union history by lesson
> `timeStamp`, last-write-wins on settings**. (Figures web-verified June 2026; re-check before
> committing — free tiers move.)

## The one hard constraint

The browser **cannot** sync a site's `localStorage`/`IndexedDB` across devices — no browser
does, and `chrome.storage.sync` is **extension-only** (and ~100 KB, far too small). So sync
**requires** one of: (a) a backend you run, (b) a managed BaaS, or (c) the user's own cloud
(BYO storage). The choice is *which*, not *whether*.

## At a glance

| Option | Your backend? | Static kept? | Auth | Free? | Provider can read? | Effort | Headline risk |
|---|---|---|---|---|---|---|---|
| **Google Drive** (appDataFolder) | **none** | ✅ | Google OAuth | ✅ (user's Drive) | yes¹ | Med | 100-user cap until brand-verified; 1h tokens (no bg sync) |
| **Cloudflare Worker + KV/D1** (sync-code + E2EE) | one tiny Worker | ✅ | anon sync-code | ✅ generous | **no (E2EE)** | Med | you own crypto; lost code = lost data |
| **Firebase** (Firestore + Auth) | none (config) | ✅ | Google/email | ✅ Spark | **yes** | Med | not local-first; Google lock-in |
| **AWS** (Amplify: Cognito + DynamoDB) | own a CFN stack | ✅ | Cognito | mostly² | yes | **High** | heaviest; new-acct auto-close landmine |
| **Supabase** (Postgres + RLS) | none (BaaS) | ✅ | magic-link/OAuth | ✅ but… | yes¹ | Med | **free project pauses after 7 idle days** |
| **Dropbox** (App folder) | none | ✅ | Dropbox OAuth | ✅ (user's Dropbox) | yes¹ | Med | Dropbox-only; prod approval > 50 users |
| **Local-first** (Jazz/Evolu/RxDB…) | Jazz=none, rest=yes | ✅ | passphrase | Jazz alpha | **no (E2EE)** | Med–High | overkill for a 5 MB blob; Jazz still alpha |

¹ unless you add client-side E2EE. ² post-2025 AWS free-tier accounts auto-close at 6 months/$200.

---

## Designs (condensed)

### 1. Google Drive — `appDataFolder` (BYO, zero backend)
Browser uses **Google Identity Services** OAuth (`drive.appdata` scope) → reads/writes one
hidden `typrlab-sync.json` in the **user's own** Drive via Drive REST v3 (`fetch`/CORS, no JS
lib needed). The blob *is* today's export payload; sync = pull → merge → push.
- **+** Zero backend & zero storage cost (data sits in the user's 15 GB); you literally can't
  read it (no DB); reuses export/import; `drive.appdata` is **non-sensitive** (light "brand"
  verification — no security assessment); static deploy untouched; E2EE easy to add.
- **−** Mandatory **Google Cloud project + OAuth client**; **100-user lifetime cap + scary
  "unverified app" screen** until you do brand verification (privacy policy + domain proof);
  **1-hour tokens, no refresh in a SPA** → only *opportunistic foreground* sync, never
  always-on background; Google-account-gated (excludes non-Google users); Google can read it
  unless E2EE.
- **Best when:** you want truly zero-backend, user-owned sync for a Google-using audience and
  will do a one-time verification.

### 2. Cloudflare Worker + KV/D1 — anonymous sync-code + E2EE  ⭐ recommended
A ~150-LOC Worker on **your existing Cloudflare account** stores one **client-encrypted** blob
per **anonymous sync code** in KV (or D1). The code derives an AES-256-GCM key in the browser
(WebCrypto/PBKDF2); the server only ever sees **ciphertext**. Front-end stays static (separate
`*.workers.dev`/`sync.typrlab.com` Worker, small CORS allowlist — or serve the static assets
*through* the Worker for same-origin).
- **+** No Google, no third party, no signup; **server is blind** (provably can't read data) —
  strongest privacy + on infra you already own; generous free tier (Workers 100k req/day, D1 5 GB);
  no user cap; background sync possible.
- **−** You now **own a small Worker** (the pure "no backend" property is gone); **you must get
  the crypto right** (KDF params, AES-GCM IV, versioned envelope); **lost sync-code = permanently
  unrecoverable** (mitigate with the existing downloadable export as a recovery file).
- **Best when:** you want server-blind sync on your own stack with no accounts and no Google.

### 3. Firebase — Firestore + Auth (zero-ops BaaS)
Firebase client SDK from the static site; Firebase Auth (Google/email) → data under
`users/{uid}` in Firestore. Config is public-by-design; security via Firestore Rules + App Check.
- **+** True zero-ops, built-in **offline persistence**, polished Google sign-in; Spark free
  tier (50k reads/20k writes/day) dwarfs this workload; static preserved.
- **−** **Not local-first**: Google can read plaintext history and **E2EE doesn't fit** Firestore's
  query model; a Firebase project **is** a Google Cloud project (lock-in, separate from your
  Cloudflare); proprietary data model → migration cost.
- **Best when:** you want lowest-maintenance sync and accept Google reading the data.

### 4. AWS — Amplify Gen2 (Cognito + DynamoDB/AppSync)
Amplify client libs → Cognito (login) + one DynamoDB item per user. You own a CloudFormation
stack (no server code, but real infra).
- **+** DynamoDB **always-free** 25 GB; Cognito 10k MAU free; proper accounts + per-user isolation;
  data in *your* AWS region (jurisdiction control); static preserved.
- **−** **Highest setup/ownership** of the realistic options; **post-July-2025 free-tier accounts
  auto-close at 6 months/$200** (need a legacy acct or accept billing); heavy lock-in; overkill
  for a 5 MB blob.
- **Best when:** you're already AWS-committed and want everything in AWS.

### 5. Supabase — Postgres + Auth + RLS
`supabase-js` from the static site; sign in (magic-link/OAuth) → one RLS-protected row per user.
- **+** Real accounts + SQL ownership; generous free (500 MB DB, 50k MAU, unlimited API);
  fast Phase-1 (one table + 4 policies); static preserved; anon key public-by-design.
- **−** **Free project auto-pauses after 7 idle days** → sync silently breaks for a low-traffic
  app (needs a keep-alive cron); provider can read data unless you add E2EE; heaviest moving
  parts (Postgres+Auth+RLS) for a key-value blob.
- **Best when:** you want real accounts *and* expect at least weekly traffic.

### 6. Dropbox — App folder (BYO, like Drive)
OAuth PKCE → read/write one JSON in the user's sandboxed `/Apps/typrlab/`. Zero backend.
- **+** User owns data; zero backend/cost to you; **lighter app review than Google**; static
  preserved (the OAuth callback is just a static page).
- **−** **Dropbox-account-gated** (adoption tax); **production approval required > 50 linked
  users**; Dropbox can read it unless E2EE.
- **Best when:** your audience uses Dropbox and you want BYO with a lighter review than Google.

### 7. Local-first engines — Jazz / Evolu / RxDB / Replicache(Zero) / ElectricSQL
Client libraries giving offline replication + auto-merge. **Only Jazz** is credibly zero-backend
(managed Jazz Cloud, **E2EE by default**, free alpha); the rest need a relay/CouchDB/Postgres
you run.
- **+** Real offline-first + multi-device + (Jazz/Evolu) **E2EE**; future-proof if per-device
  state grows.
- **−** **Overkill** — you'd adopt a DB/replication framework to sync a 5 MB blob; only Jazz
  meets "no backend," and it's **alpha** with usage-pricing not locked; refactors `persist.ts`
  around a CoValue store.
- **Best when:** you later want real-time multi-device + E2EE + no-ops and accept alpha risk.

---

## Reference: how keybr.com does it

Verified from keybr's open-source monorepo ([aradzie/keybr.com](https://github.com/aradzie/keybr.com),
AGPL-3.0) — the packages tell the whole story:

- `server` / `server-cli` / `keybr-pages-server` — a **full Node.js server** (keybr is
  server-rendered, **not** static/local-first like typrlab).
- `keybr-database` — a **relational DB** (schema + model; `DATABASE_CLIENT` supports SQLite,
  prod uses a real SQL server).
- `keybr-oauth` — **social OAuth** adapters for **Google, Facebook, Microsoft**, plus
  **email magic-link** sign-in.
- `keybr-result-userdata` / `keybr-settings-database` / `page-account` — user results +
  settings stored **server-side**, keyed to the account.

**So keybr = the classic "run your own backend" model:** its own server + SQL DB + social
login; signed-in users' data lives on **keybr's servers**, so cross-device sync is just
"log in anywhere." Anonymous users keep data locally; signing in associates it to the account.

**What it means for typrlab:** keybr's approach is essentially an **8th option — self-hosted
full-stack** — and it's the **heaviest** one. It throws away the static/serverless model (you'd
operate a persistent server + managed DB), still needs OAuth apps per provider (→ back to
Google Cloud et al.), and the operator (you) can read all data — the opposite of typrlab's
local-first posture. keybr chose it because keybr was already a server-rendered app with its own
infra. **Not a model to copy for a static, solo, privacy-first app** — but a useful proof that
"server + DB + social OAuth" works at scale if you ever want full accounts.

## Recommendation

For typrlab specifically — **solo maintainer, privacy/local-first values, free, already on
Cloudflare, a single-user few-MB blob** — two finalists:

1. **⭐ Cloudflare Worker + KV + sync-code + E2EE.** Best fit: on infra you already own, **no
   Google, no third-party, no accounts, no user cap, server-blind by design.** Cost is the one
   tiny Worker + getting the crypto right (well-trodden: WebCrypto AES-GCM + PBKDF2). The
   "lost code = lost data" edge is softened by the **existing JSON export** as a recovery file.

2. **Google Drive appDataFolder** — pick this if you'd rather run **literally zero backend** and
   your audience is Google-friendly, accepting the one-time brand verification and
   foreground-only sync. (Lighter than I first warned — `appdata` is non-sensitive.)

**Avoid for now:** Supabase (7-day pause), AWS (weight + free-tier landmine), Firebase
(not local-first). **Defer:** local-first/Jazz until you actually need real-time multi-device.

### Phased plan for the recommended pick (Cloudflare + sync-code + E2EE)
1. **`src/core/sync/merge.ts`** — pure, unit-tested: history union by `timeStamp` + settings LWW.
2. **`src/core/sync/crypto.ts`** — WebCrypto AES-256-GCM + PBKDF2, versioned envelope; tested.
3. **The Worker** (`workers/sync/`) — `GET/PUT /v1/blob/:codeHash`, KV-backed, optimistic
   concurrency (`If-Match`/rev), CORS allowlist. Deploy via wrangler.
4. **`useSync` hook + Settings "Sync" group** — generate/enter code, "Sync now", status,
   disconnect; debounced auto-push later.
5. **Recovery UX** — reuse the JSON export as the offline backup; clear "no recovery without the
   code" warning.

Storage keys, the engine, and the static deploy are all untouched.
