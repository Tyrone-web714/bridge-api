# Render Environment Verification

Status: PASSED WITH LIMITATION.

## Verified Production Service

The actual deployed Render service is the intended Truck-Safe Routing production backend service.

| Item | Verified result |
| --- | --- |
| Render service name | `truck-safe-routing-api` |
| Render service ID | `srv-d88mcejbc2fs73ecv8b0` |
| Runtime | Docker |
| Plan | Starter |
| Region | Oregon |
| Blueprint managed | yes |
| Repository | `Tyrone-web714 / bridge-api` |
| Branch | `main` |
| Root directory | `bridge-api` |
| Dockerfile/build context | `bridge-api/` |
| Public URL | `https://truck-safe-routing-api.onrender.com` |
| Health check path | `/health` |
| Auto-deploy | On Commit |
| Maintenance mode | Disabled |

## Deployed Release Alignment

| Item | Verified result |
| --- | --- |
| Latest deployed short commit | `632709e` |
| Latest deployed full commit | `632709e0ee9adf934c4f157017fbbfaf9a158872` |
| Deployed commit message | `Validate and harden Enterprise Identity foundation` |
| Render deploy status | Live |
| Render deploy time | July 18, 2026 at 8:21:29 AM CDT |
| `origin/main` | `632709e0ee9adf934c4f157017fbbfaf9a158872` |
| Local `main` | `632709e0ee9adf934c4f157017fbbfaf9a158872` |
| Alignment result | PASSED |

The later `operational-readiness-verification` commits are documentation-only evidence commits and are not application deployment drift.

## Environment Variable Name Inventory

Actual Render environment variable names were inspected from the production service dashboard. Secret values were not printed, copied into Git, or documented.

| Variable | Status | Evidence / note |
| --- | --- | --- |
| `ADMIN_DASHBOARD_ADMINS` | PRESENT | name present |
| `ADMIN_DASHBOARD_PASSWORD` | PRESENT | name present; readiness reports configured |
| `ADMIN_DASHBOARD_ROLE` | PRESENT | name present |
| `ADMIN_DASHBOARD_SECRET` | PRESENT | name present; length check passed by safe metadata; readiness reports configured |
| `BACKEND_PUBLIC_URL` | PRESENT | name present; safe metadata matches Render backend URL |
| `CORS_ORIGIN` | PRESENT WITH DRIFT | name present, but value is wildcard; repo production verification rejects wildcard CORS for production |
| `DATABASE_SSL` | PRESENT | name present; safe metadata confirms `true` |
| `DATABASE_URL` | PRESENT | name present; safe metadata points to production database host `dpg-d88mpah9rddc738jl2tg-a`, not restore host `dpg-d9dq9qe1a83c73b85sq0-a` |
| `DRIVER_API_TOKEN` | PRESENT | name present; length check passed by safe metadata |
| `GOOGLE_MAPS_API_KEY` | PRESENT | name present; readiness reports configured |
| `NODE_ENV` | PRESENT | safe metadata confirms production mode |
| `OPENAI_API_KEY` | PRESENT | name present |
| `OPENAI_MODEL` | PRESENT | name present; safe metadata confirms non-empty |
| `PHOTO_STORAGE_ACCESS_KEY_ID` | PRESENT | name present |
| `PHOTO_STORAGE_BUCKET` | PRESENT | name present |
| `PHOTO_STORAGE_ENDPOINT` | PRESENT | name present |
| `PHOTO_STORAGE_FORCE_PATH_STYLE` | PRESENT | name present; safe metadata confirms `true` |
| `PHOTO_STORAGE_PROVIDER` | PRESENT | name present; safe metadata and `/health` confirm `s3` |
| `PHOTO_STORAGE_PUBLIC_BASE_URL` | PRESENT | name present |
| `PHOTO_STORAGE_REGION` | PRESENT | name present |
| `PHOTO_STORAGE_SECRET_ACCESS_KEY` | PRESENT | name present |
| `PUBLIC_API_BASE_URL` | NOT APPLICABLE | mobile/public API config example variable; backend does not require it for current deployed readiness |
| `PG_POOL_MAX` | NOT APPLICABLE | optional tuning variable; backend defaults apply when absent |
| `PG_CONNECTION_TIMEOUT_MS` | NOT APPLICABLE | optional tuning variable; backend defaults apply when absent |
| `PG_IDLE_TIMEOUT_MS` | NOT APPLICABLE | optional tuning variable; backend defaults apply when absent |
| `DRIVER_SESSION_HOURS` | NOT APPLICABLE | optional; backend default applies when absent |
| `ALLOW_LEGACY_DRIVER_API_TOKEN` | NOT APPLICABLE | absent; backend default is disabled unless explicitly set to `true` |
| `ALLOW_PRODUCTION_LIFECYCLE_PURGE` | NOT APPLICABLE | absent; purge remains disabled unless explicitly enabled |
| Enterprise Identity provider secrets | NOT APPLICABLE | provider verification is paused and no provider is enabled for production |

## Database Target And Security

`DATABASE_URL` was verified by safe metadata comparison only. The Render value points to the intended production database resource host `dpg-d88mpah9rddc738jl2tg-a` and database `truck_safe_routing_db`.

It does not point to the temporary restore rehearsal database host `dpg-d9dq9qe1a83c73b85sq0-a`.

`DATABASE_SSL` is present and safely verified as enabled.

## Object Storage Configuration

Object-storage configuration variable names are present, including provider, bucket, region, endpoint, force-path-style, access key, secret key, and public base URL.

Deployed `/health` reports:

- provider: `s3`
- configured: true
- durable: true

No object-storage mutation test was performed in this phase.

## Deployed Health And Readiness

`npm.cmd run check:deployed -- https://truck-safe-routing-api.onrender.com` passed.

- `/health`: HTTP 200
- `/ready`: HTTP 200
- database: PostgreSQL
- PostGIS: true
- driver auth: configured
- photo storage: `s3`, configured, durable
- readiness checks passed for Google Maps key, admin password, admin secret, database configured/reachable, PostGIS, photo storage, durable photo storage, and driver auth

## Schema Compatibility

Deployed code commit `632709e0ee9adf934c4f157017fbbfaf9a158872` includes foundation code through Enterprise Identity and expects migrations `001` through `010`.

The owner-approved production preflight and restored-copy preflight both verified migrations `001` through `010` and expected foundation tables. Application code and production schema are compatible for the verified foundation baseline.

## Configuration Drift

Confirmed drift:

- `CORS_ORIGIN` is configured as wildcard. The repository production verification tooling treats wildcard CORS as invalid for production pilot configuration. This is a High configuration issue to remediate before production rollout GO.

Non-blocking differences / defaults:

- optional tuning variables such as `PG_POOL_MAX`, `PG_CONNECTION_TIMEOUT_MS`, `PG_IDLE_TIMEOUT_MS`, and server timeout variables are absent and therefore use backend defaults.
- `ALLOW_LEGACY_DRIVER_API_TOKEN` is absent, which leaves the legacy shared token path disabled by default.
- `ALLOW_PRODUCTION_LIFECYCLE_PURGE` is absent, which leaves production purge execution disabled by default.

## Production Safety

Production data modified: no.

Production environment variables changed: no.

Production service restarted: no.

Deployment triggered: no.

Secrets printed or committed: no.
