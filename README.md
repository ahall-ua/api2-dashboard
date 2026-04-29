# API2 Dashboard

Internal web dashboard for browsing and downloading UA software artifacts (apps, plugins, firmware) from api2.uaudio.com. Replaces the need to use the UACH/UAC desktop app for simple browsing and version inspection.

**Tier 3** application under the AI-Assisted Application Development & Deployment Policy:
server-side logic + runtime calls to third-party APIs + file downloads served through the app.

## Pages

- **Dashboard** (`/dashboard`) — tile view, focuses on a single phase. Best for "what's deployed in beta right now" glance.
- **Grid** (`/grid`) — full matrix: products as rows, phases as columns, mac/win/all variants per cell. Best for cross-phase comparisons.
- **Product detail** (`/apps/[id]` or `/plugins/[id]`) — full version history, download links, Bamboo build cross-references.

Filter pills on each page (`Show`, `Phases`, `Platforms`, plus `Branches` / `Bamboo` / `Sentry` toggles) are URL-driven and survive navigation between Dashboard ↔ Grid ↔ Detail. Bookmark a filtered view by copying the URL.

## Stack

- **Next.js 16** (App Router, server components + API routes)
- **React 19** + Tailwind CSS 4 + shadcn/ui
- **iron-session** for encrypted session cookies (per-user api2 token + credentials)
- **TypeScript**

## Setup (local)

```bash
cp .env.local.example .env.local
# Fill in real values; see "Environment variables" below

npm install
npm run dev
# Open http://localhost:3000
```

Sign in with your api2 (uaudio.com) credentials.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `API2_API_KEY` | yes | Shared `X-Api-Key` for the prod api2 environment |
| `API2_BASE_URL` | no | Defaults to `https://api2.uaudio.com` |
| `API2_STAGE_API_KEY` | no | If set, the login form offers a `stage` env toggle |
| `API2_STAGE_BASE_URL` | no | Defaults to `https://api2.stage.uaudio.com` |
| `SESSION_SECRET` | yes | 32+ char random string used to encrypt session cookies |
| `BAMBOO_TOKEN` | no | Bearer token for `bamboo.uaudio.com` REST API. If unset, Bamboo links/labels/sentry features quietly disable. |
| `COOKIE_SECURE` | no | Set to `true` in production so cookies are HTTPS-only |
| `API2_TIMING` | no | Set to `1` to print api2 timing summaries to the server log on each dashboard render |

## Deploy (Docker / Compose)

```bash
docker compose up -d --build
# Logs:    docker compose logs -f
# Restart: docker compose restart
# Stop:    docker compose stop
```

`deploy.sh` is a thin wrapper around the same command, intended for use on a VPN-only host.

## Third-party services used at runtime

This is the Tier 3 §7.2 documentation of every external service the running app calls.
All calls are made **server-side from Node**; secrets never reach the browser.

### 1. api2.uaudio.com (UA's product/version catalog)

- **Endpoint family**: `https://api2.uaudio.com/*` (and `https://api2.stage.uaudio.com/*` if stage env is in use)
- **What's sent**:
  - On login: the user's UA account `username` and `password` to `POST /user/tokens`, plus the `X-Api-Key` header.
  - On every other call: the user's session token (returned from login) as `Authorization: <token>`, plus the `X-Api-Key` header.
- **What's received**:
  - Auth token for the session
  - Lists of apps, plugins, versions, components, license metadata
  - Pre-signed install / update URLs for downloads
- **Why**: the dashboard is purely a more convenient front-end over api2; api2 owns the data.
- **Code paths**: `src/lib/api2-client.ts`, `src/lib/fetch-matrix.ts`, `src/app/api/proxy/[...path]/route.ts`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/refresh/route.ts`.
- **Secrets handling**: `API2_API_KEY` is read from env at request time and attached to the outgoing header. The user's `username`/`password`/`token` live in the encrypted iron-session cookie (`SESSION_SECRET`) so the server can transparently refresh the token when it expires (~55 min). The password is never sent to a third party other than api2 itself.

### 2. bamboo.uaudio.com (UA's Atlassian Bamboo CI)

- **Endpoint family**: `https://bamboo.uaudio.com/rest/api/latest/*`
- **What's sent**: `Authorization: Bearer ${BAMBOO_TOKEN}`. Plan keys, build numbers, and `expand=` directives in the query string. No user identity is sent — the dashboard uses a service-style bearer token shared by all sessions.
- **What's received**: build results (state, timestamps, build numbers), build comments (Sentry release URLs are extracted from these), build labels, and build variables (specifically `inject.uaReleaseName`, used to match Bamboo builds to api2 versions).
- **Why**: cross-references each api2 version with the Bamboo build that produced it — for "open this build's Bamboo page", labels, and Sentry release links.
- **Code paths**: `src/lib/bamboo-api.ts`, `src/app/api/bamboo/builds/route.ts`, `src/app/api/bamboo/redirect/route.ts`.
- **Optional**: if `BAMBOO_TOKEN` is unset, Bamboo features are silently skipped — the dashboard still works.

### 3. content.apps.uaudio.com (S3-hosted Bamboo manifest)

- **Endpoint**: `https://content.apps.uaudio.com/internal/bamboo-manifest.json`
- **What's sent**: nothing other than a plain unauthenticated GET.
- **What's received**: a JSON manifest mapping product names → Bamboo project + plan keys. Generated upstream by `~/src/uapkg/tools/bamboo/plan-generation/emit_manifest.py` and uploaded to S3 after every plan regeneration.
- **Why**: lets the dashboard turn product names into Bamboo plan URLs without hard-coding the mapping.
- **Code paths**: `src/lib/bamboo-manifest.ts`. Cached server-side for 5 minutes.

### 4. sentry.io (read-only links only)

The dashboard does **not** call Sentry's API. It only renders `https://*.sentry.io/...` URLs that it scraped out of Bamboo build comments, as click-to-open external links. No identifying data is sent to Sentry by the dashboard itself; it's just a hyperlink.

## Data the app stores

- **Encrypted session cookie** (per-user, set by iron-session): username, password, current api2 token, expiry, and chosen env (prod/stage). Cookie is HTTP-only, encrypted with `SESSION_SECRET`.
- **In-memory caches** on the Node server: api2 matrix data (5-minute TTL, keyed by user + endpoint + filters); Bamboo build map per product (60-second TTL); per-build Bamboo lookup results (10-minute TTL); bamboo-manifest (5-minute TTL).
- **No database**. No on-disk persistence beyond the container itself.

## Deployment expectations (Tier 3)

- VPN/office-only access enforced at the hosting platform layer (not the app).
- Secrets injected from a managed secrets manager (e.g. AWS Secrets Manager) into env at runtime, not committed.
- Centralized logging: structured logs forwarded via the company-approved logger (integration pending).
- CI/CD: GitHub Actions pipeline managed by the AI Platform Engineering team, with `npm audit` / Dependabot scanning.

## Ownership

- **Primary**: TBD
- **Secondary**: TBD

When an owner leaves UA, ownership must be reassigned per Section 9.1 of the AI-Assisted Application policy.
