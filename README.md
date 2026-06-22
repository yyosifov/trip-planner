# trip-planner

AI-powered family trip planner. Chat intake → research → curate on map → day-by-day itinerary with weather backups.

## Prerequisites

- Node.js 22+
- pnpm 11+ (`npm i -g pnpm`)
- PostgreSQL running on `localhost:5432`

## Setup

```bash
# 1. Install dependencies (also builds @trip/shared)
pnpm install
pnpm --filter @trip/shared build

# 2. Create databases
psql -U postgres -c "CREATE DATABASE trip_planner;"
psql -U postgres -c "CREATE DATABASE trip_planner_test;"

# 3. Copy and fill env
cp .env.example .env
# Edit .env — add GEMINI_API_KEY, BRAVE_API_KEY, optionally GOOGLE_MAPS_API_KEY

# 4. Run migrations
pnpm --filter api exec prisma migrate deploy
```

## Running locally

```bash
# Terminal 1 — API (port 3000)
pnpm --filter api start:dev

# Terminal 2 — Web (port 5173)
pnpm --filter web dev
```

Open http://localhost:5173

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://myuser:mypassword@localhost:5432/trip_planner` |
| `TEST_DATABASE_URL` | ✅ | `postgresql://myuser:mypassword@localhost:5432/trip_planner_test` |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `BRAVE_API_KEY` | ✅ | Brave Search API key |
| `GOOGLE_MAPS_API_KEY` | ❌ | Google Maps server key (map pins disabled without it) |
| `VITE_GOOGLE_MAPS_API_KEY` | ❌ | Google Maps browser key (same key works) |
| `VITE_API_URL` | ❌ | API base URL (defaults to `http://localhost:3000`) |
| `WEB_ORIGIN` | ❌ | CORS origin (defaults to `http://localhost:5173`) |

## Tests

```bash
# All tests
pnpm --filter @trip/shared test
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter web test
```

## Project structure

```
trip-planner/
  packages/shared/   # Zod schemas shared between API and web
  apps/api/          # NestJS + Prisma backend
  apps/web/          # React + Vite frontend
```

## Deployment

Deployed on Railway. See `apps/api/Dockerfile`, `apps/web/Dockerfile`, `railway.json`.
