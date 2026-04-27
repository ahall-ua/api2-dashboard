# API2 Dashboard

Web dashboard for browsing and downloading UA software artifacts from api2.

## Setup

```bash
cd tools/api2
cp .env.local.example .env.local
# Edit .env.local: set API2_API_KEY and SESSION_SECRET

npm install
npm run dev
# Open http://localhost:3000
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `API2_BASE_URL` | API2 base URL (default: https://api2.uaudio.com) |
| `API2_API_KEY` | Shared API key for api2 |
| `SESSION_SECRET` | Random 32+ char string for encrypting session cookies |

## Docker

```bash
docker compose up --build
```

## Features

- Login with UA credentials (email/password)
- Dashboard overview: apps and plugins with latest version per phase per platform
- Phase matrix showing dev/alpha/beta/rc/final deployment status
- Deployment timestamps
- Direct download links for app installers and updaters
- Plugin component browsing and download
- Detail pages with full version history
