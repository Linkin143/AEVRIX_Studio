# AEVRIX Video Studio

AEVRIX is a local-first AI video creation studio. It combines a polished Next.js creator workspace with an Express API, SQLite metadata, local media storage, and a provider-independent generation queue. Seedance 2.0 is available through Replicate; mock mode exercises the same persisted workflow without API charges.

## Prerequisites

- Node.js 20.11 or newer (Node 22 LTS recommended)
- npm 10 or newer, included with Node.js
- Optional: a system FFmpeg/ffprobe installation. Bundled binaries provide the default local fallback.
- A Replicate API token only when using the real provider

Windows PowerShell is fully supported.

## Install

```powershell
Copy-Item .env.example .env
npm install
npm run setup
```

The defaults create `data/aevrix.db` and use the directories beneath `storage/`. Never commit `.env`.

## Run locally

```powershell
npm run dev
```

- Studio: http://localhost:3000
- API health: http://127.0.0.1:5000/api/health

Run one process when troubleshooting:

```powershell
npm run dev:api
npm run dev:web
```

## Mock mode

Set `ENABLE_MOCK_PROVIDER=true`. Mock jobs use real SQLite records, credit reservations, queue transitions, local output copying, history, and management actions. The API generates a deterministic five-second H.264 test video on first use with its bundled FFmpeg binary. You can replace it or regenerate it with:

```powershell
npm run mock:fixture
```

Completed provider videos still save and play if media probing or thumbnail generation fails.

## Replicate mode

Set:

```env
ENABLE_MOCK_PROVIDER=false
REPLICATE_API_TOKEN=r8_your_token
```

The token is consumed only by the API. It is never included in frontend data or logs. You may also save a token from local Settings; the backend writes it to the ignored root `.env` file and never returns it to the browser.

The model dropdown includes Seedance 2.5, Seedance 2.0, MiniMax H3, and WAN 3.0. If the corresponding Replicate deployment slug differs for your account, override it without changing code:

```env
REPLICATE_SEEDANCE_25_MODEL=bytedance/seedance-2.5
REPLICATE_MINIMAX_H3_MODEL=minimax/h3
REPLICATE_WAN_30_MODEL=wan-video/wan-3.0
```

Polling works without public ingress. To use webhooks, expose the API through an HTTPS tunnel and set:

```env
REPLICATE_WEBHOOK_URL=https://your-tunnel.example/api/webhooks/replicate
REPLICATE_WEBHOOK_SECRET=whsec_your_signing_secret
```

The webhook endpoint validates Standard Webhooks signatures and deduplicates event IDs.

## Build and test

```powershell
npm test
npm run build
npm run test:e2e
npm start
```

Automated tests never call Replicate. Playwright expects mock mode and a migrated database.

## Project layout

```text
apps/web                 Next.js creator application
apps/api                 Express API, Prisma, providers, queue
packages/shared-types    frontend/backend contracts
data                     SQLite database
storage                  local inputs, videos, thumbnails, exports
docs                     implementation plan and API reference
```

## Troubleshooting

- **Prisma cannot find `DATABASE_URL`:** ensure `.env` exists at repository root and run commands from the root.
- **Replicate not configured:** enable mock mode or set the server token, then restart the API.
- **No thumbnail:** install FFmpeg and ensure both `ffmpeg` and `ffprobe` are on `PATH`. The video itself remains valid.
- **Webhook rejected:** confirm the exact raw-body signing secret and that the tunnel forwards the signature headers unchanged.
- **Port already used:** change `PORT` and `NEXT_PUBLIC_API_URL` together; change the web port with `npm run dev:web -- -p 3001`.
- **Asset rejected:** confirm both its extension/content and supported MIME type; uploads are limited to 100 MB.

See [the implementation plan](docs/IMPLEMENTATION_PLAN.md) and [API reference](docs/api.md).


From the project folder:
cd C:\Documents\MyPersonal\AEVRIX_Studio
npm install
Copy-Item .env.example .env
npm run setup
For local mock generation, set this in .env:
ENABLE_MOCK_PROVIDER=true
Run both servers together:
npm run dev
Or separately:
# Terminal 1 — Backend
npm run dev:api
# Terminal 2 — Frontend
npm run dev:web
Open:
- Frontend: http://localhost:3000
- Backend health: http://127.0.0.1:5000/api/health
