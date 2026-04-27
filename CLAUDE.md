@AGENTS.md

## Project Overview

Internal web dashboard to browse and download software artifacts from api2.uaudio.com. Replaces the need for UACH/UAC desktop app for simple browsing and downloading.

- **Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, iron-session
- **Auth:** JWT token + X-Api-Key header, proxied through Next.js API routes to avoid exposing credentials client-side
- **Environments:** prod (api2.uaudio.com) and stage (api2.stage.uaudio.com), switchable per session

## Architecture

- `src/app/api/proxy/[...path]/route.ts` — server-side proxy to api2, attaches auth headers
- `src/app/api/auth/` — login, logout, token refresh routes using iron-session
- `src/app/dashboard/page.tsx` — main dashboard, server component that fetches app + plugin matrix data
- `src/components/dashboard-content.tsx` — client component with tabs for apps/plugins, phase filtering
- `src/components/phase-matrix.tsx` — the phases × platforms grid view
- `src/lib/fetch-matrix.ts` — builds MatrixRow[] from api2 responses
- `src/lib/api2-client.ts` — typed fetch wrapper for api2

## Bamboo Integration (in progress)

### Goal
Link deployed artifacts back to Bamboo CI — show build status, link to build logs, commit history, and detect release branches.

### Approach
1. **Manifest script** at `~/src/uapkg/tools/bamboo/plan-generation/emit_manifest.py` reads all plan JSON files from the `uapkgspec` repo and emits a consolidated `bamboo-manifest.json`
2. Manifest maps product names → Bamboo project_key + plan_key, plus `ua_api2_name` for correlation with api2 product names
3. Script is also hooked into `generate_plans.py` as a post-step so the manifest stays current whenever any product's plans are regenerated
4. **Dashboard fetches** the manifest from `https://content.apps.uaudio.com/internal/bamboo-manifest.json` (public S3 bucket, server-side only with 5-min TTL cache)

### Manifest structure
```json
{
  "generated_at": "...",
  "products": {
    "product_key": {
      "display_name": "...",
      "family": "houston|hbplug|uad2|...",
      "plans": {
        "ci": { "project_key": "...", "plan_key": "..." },
        "nightly_mac": { "project_key": "...", "plan_key": "..." },
        "nightly_win": { "project_key": "...", "plan_key": "..." }
      },
      "ua_api2_name": "...",
      "ua_branch": "...",
      "supported_platforms": ["mac", "win"]
    }
  },
  "branches": {
    "branch_name": ["product1", "product2"]
  }
}
```

### Linking manifest products to api2 products
- **Apps:** Match `manifest.products[x].ua_api2_name` to `api2 app.name`
- **UAD2 plugins:** Match `manifest.products[x].ua_api2_plugins` (comma-separated) to api2 plugin names
- **HBplugs:** Match by product key convention (e.g. `uaudio_studer_a800`)
- **Content:** Match `manifest.products[x].ua_content_id` to api2 content names

### Bamboo URL construction
```
https://bamboo.uaudio.com/browse/{project_key}-{plan_key}
```

### Key files
- `src/lib/bamboo-manifest.ts` — types, fetch with TTL cache, product matching helpers
- `src/components/bamboo-links.tsx` — renders plan links for matched products
- Detail pages (`apps/[id]`, `plugins/[id]`) fetch manifest and pass matched products to BambooLinks

### Key notes
- uapkgspec hbplug data covers UADX plugins but was never put into production (plan keys are stable, branches/versions may be stale)
- UAPW wrapper plans (uapwuad2) are excluded from the manifest — only care about HBPLUG build plans
- Manifest hosted on `content.apps.uaudio.com` (public, not VPN-gated) — contains no credentials, just plan keys and branch names
- `generate_plans.py` uploads manifest to S3 after every successful plan generation via `emit_manifest.upload_to_s3()`

## TODO
- [x] Choose S3 bucket and configure upload credentials for emit_manifest.py
- [x] Add manifest fetch to dashboard (server-side, cached)
- [x] Render Bamboo links on app/plugin detail pages
- [ ] Show release branch info in the dashboard
- [ ] (Future) Hit Bamboo REST API for live build status using plan keys from manifest
