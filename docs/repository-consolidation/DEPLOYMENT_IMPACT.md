# Deployment Impact

## Current Backend Deployment

Current backend deployment relies on:

- Render web service `truck-safe-routing-api`.
- Docker environment.
- root `render.yaml` with `rootDir: bridge-api`.
- backend `Dockerfile` inside `C:\dev\bridge-api\bridge-api`.
- `npm start` running migrations then `server.js`.
- `/health` Render health check.
- `/ready` production readiness check.

## Render Impact

If backend remains temporarily at `bridge-api/`, Render can continue using `rootDir: bridge-api`.

If backend moves to `apps/api`, Render must later change to `rootDir: apps/api`. Do not make that change until backend install, Docker build, health, readiness, migrations, and static data loading pass.

## Backend Variables

Do not change environment variable names:

- `DATABASE_URL`, `DATABASE_SSL`
- `GOOGLE_MAPS_API_KEY`
- `ADMIN_DASHBOARD_*`
- `DRIVER_API_TOKEN`
- `CORS_ORIGIN`, `BACKEND_PUBLIC_URL`
- `PHOTO_STORAGE_*`
- `OPENAI_*`

## Mobile EAS Impact

If mobile moves to `apps/mobile`, EAS commands must run from `apps/mobile`.

Path-sensitive mobile files:

- `app.config.js` reads `.env` from `__dirname`.
- `app.json` references `./assets/...`.
- `app.config.js` references `./plugins/withTruckSafeNetworkSecurity`.
- EAS profiles live in `eas.json`.

Keep `.env.example`, `assets/`, `plugins/`, `app.config.js`, `app.json`, and `eas.json` together.

## CI/CD Recommendation

Initial CI should use app-local commands:

```powershell
npm --prefix apps/api ci
npm --prefix apps/api test
npm --prefix apps/mobile ci
npm --prefix apps/mobile run verify:production
```

Only add workspace-wide CI after both apps validate independently.
