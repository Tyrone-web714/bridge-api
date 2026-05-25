# Truck-Safe Routing API Deployment

## Required Environment Variables

```env
GOOGLE_MAPS_API_KEY=your_server_side_google_maps_key
PORT=5000
CORS_ORIGIN=https://your-approved-origin.example
DATABASE_URL=postgres://username:password@host:5432/truck_safe_routing
DATABASE_SSL=true
ADMIN_DASHBOARD_PASSWORD=strong-supervisor-password
ADMIN_DASHBOARD_SECRET=long-random-cookie-signing-secret-at-least-32-characters
ADMIN_DASHBOARD_ADMINS=admin
ADMIN_DASHBOARD_ROLE=supervisor
ADMIN_CREATE_USERNAME=admin
ADMIN_CREATE_PASSWORD=temporary-strong-password-used-once
ADMIN_CREATE_ROLE=admin
ADMIN_CREATE_DISPLAY_NAME=Supervisor Admin
DRIVER_API_TOKEN=random-driver-app-token-at-least-32-characters
BACKEND_PUBLIC_URL=https://your-deployed-api.example
PHOTO_STORAGE_PROVIDER=s3
PHOTO_STORAGE_BUCKET=truck-safe-routing-delivery-photos
PHOTO_STORAGE_REGION=us-east-1
PHOTO_STORAGE_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
PHOTO_STORAGE_FORCE_PATH_STYLE=true
PHOTO_STORAGE_ACCESS_KEY_ID=object-storage-access-key
PHOTO_STORAGE_SECRET_ACCESS_KEY=object-storage-secret-key
PHOTO_STORAGE_PUBLIC_BASE_URL=https://your-photo-cdn-or-bucket-url.example
```

The backend key must be a server-side Google key with the Directions API enabled. For production, restrict it by the backend host's outbound IP if the hosting provider gives you a stable egress IP.

For production pilot, do **not** leave `CORS_ORIGIN=*`. Set it to the exact deployed app/web origins that should be allowed to call the backend.

Delivery-note photos must not use local disk in production. Set `PHOTO_STORAGE_PROVIDER=s3` and point it at durable S3-compatible object storage such as AWS S3, Cloudflare R2, or another provider with an S3 API. `PHOTO_STORAGE_PUBLIC_BASE_URL` must be the public URL prefix where uploaded photos can be read by the driver app and admin dashboard.

To move existing local delivery-note photos into the configured object storage provider:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm.cmd run photos:migrate
```

Set `PHOTO_MIGRATION_DELETE_LOCAL=true` only after confirming the migrated photos open correctly from the driver app and admin dashboard.

## Health Check

```text
GET /health
GET /ready
```

Expected response:

```json
{
  "ok": true,
  "service": "bridge-api",
  "uptime_s": 123
}
```

`/health` confirms the process is running.

`/ready` confirms production dependencies are configured:

- Google Maps key
- Admin password/secret
- PostgreSQL database
- PostGIS spatial support
- Durable photo storage

## Render Deployment

1. Push this backend folder to a Git repository.
2. In Render, create a new Blueprint or Web Service from the repo.
3. Use the included `render.yaml`.
4. Add all secret environment variables in Render:
   - `GOOGLE_MAPS_API_KEY`
   - `DATABASE_URL`
   - `ADMIN_DASHBOARD_PASSWORD`
   - `ADMIN_DASHBOARD_SECRET`
   - `DRIVER_API_TOKEN`
   - `CORS_ORIGIN`
   - `BACKEND_PUBLIC_URL`
   - `PHOTO_STORAGE_PROVIDER`
   - `PHOTO_STORAGE_BUCKET`
   - `PHOTO_STORAGE_REGION`
   - `PHOTO_STORAGE_ACCESS_KEY_ID`
   - `PHOTO_STORAGE_SECRET_ACCESS_KEY`
   - `PHOTO_STORAGE_PUBLIC_BASE_URL`
5. Confirm `/health` returns `ok: true`.
6. Confirm `/ready` returns `ok: true`. Render uses `/health` as the platform health check so the container can start even while you are still correcting environment variables. Production readiness is still gated by `/ready` and `npm.cmd run check:deployed`.
7. Set the mobile app's `EXPO_PUBLIC_API_BASE_URL` to the deployed API URL.

After the hosted backend is live, verify it from your computer:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm.cmd run check:deployed -- https://your-deployed-api.example
```

This is the cloud equivalent of `npm.cmd run check:runtime`. It refuses to test `localhost`, `127.0.0.1`, or `192.168.x.x` because those are local/private addresses, not production deployment URLs.

## Create The First Named Admin User

After `DATABASE_URL` is configured, create the first named admin user:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm.cmd run admin:create -- --username admin --password "replace-with-a-strong-password" --role admin --display-name "Supervisor Admin"
```

The old shared `ADMIN_DASHBOARD_PASSWORD` remains only as a bootstrap fallback. Production pilot should use named users from `admin_users` so each supervisor/admin action can be tied to an individual account.

## Driver App Request Token

Set the same random `DRIVER_API_TOKEN` on the backend and `EXPO_PUBLIC_DRIVER_API_TOKEN` in the mobile app environment before building the pilot app. The backend requires this token on driver write actions such as safe-route requests, hazard reports, route replay events, and delivery-note edits.

## Mobile Build-Time Keys

The Android Maps SDK key is injected at native build time from the mobile app environment:

```env
EXPO_PUBLIC_ANDROID_MAPS_API_KEY=restricted-android-maps-sdk-key
EXPO_PUBLIC_DRIVER_API_TOKEN=same-value-as-backend-driver-token
EXPO_PUBLIC_DRIVER_ID=driver-id
EXPO_PUBLIC_DRIVER_NAME=Driver Display Name
EXPO_PUBLIC_API_BASE_URL=https://your-deployed-api.example
```

Run this from `C:\dev\tsr-mobile` before creating the pilot build:

```powershell
npm.cmd run verify:production
```

Run secret audits before pushing code or building pilot artifacts:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm.cmd run verify:secrets

cd "C:\dev\tsr-mobile"
npm.cmd run verify:secrets
```

## Local Production Verification

From the backend folder:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm.cmd run verify:production
```

This command checks required production-pilot environment variables, database connectivity, PostGIS readiness, durable photo storage, and at least one active named admin user.

For Cloudflare R2, verify object storage directly before deploying:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm.cmd run photos:verify-storage
```

## Production Pilot Rule

Backend deployment is not considered complete until:

- `/health` returns `ok: true`
- `/ready` returns `ok: true`
- `npm.cmd run verify:production` passes
- The mobile app can call the deployed `/api/routing/safe-route` endpoint
- Delivery-note photos upload, display in the driver app, display in the admin dashboard, and persist after backend redeploy
- Existing local delivery-note photos have been migrated with `npm.cmd run photos:migrate`
