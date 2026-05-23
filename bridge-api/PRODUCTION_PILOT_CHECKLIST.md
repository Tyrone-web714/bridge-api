# Truck-Safe Routing Production Pilot Checklist

This list is frozen as the production-pilot closure track. New ideas should wait unless they directly support one of these items.

## Pilot Completion Estimate

- Current production-pilot readiness: **55-60%**
- Target for pilot readiness: **100% after items 1-10 are completed and field-tested**

## Required Before Production Pilot

| # | Item | Status | Definition of Done |
|---|------|--------|--------------------|
| 1 | Cloud deployment for backend | In progress - deployment smoke test added | Backend deploys to a cloud host, `/health` and `/ready` pass, environment variables are configured, and the mobile app can call the deployed URL. |
| 2 | Durable cloud photo storage | Implemented locally - pending hosted env | Delivery-note photos are stored outside local disk using durable object storage. |
| 3 | Real login/users/roles | In progress - named admin users added | Admin/supervisor access uses named users and role enforcement, not only a shared password. |
| 4 | Stronger driver authentication | In progress - driver API token added | Driver app requests include a driver identity/session that the backend can validate. |
| 5 | Production API key security | In progress - env injection and secret audits added | Google/API keys are server-side, restricted, documented, and not stored in source control. |
| 6 | Route replay timeline polish | Started | Supervisors can step through route events clearly and inspect incident sequence on the map. |
| 7 | More complete no-truck/residential datasets | In progress | Four-state no-truck and residential data are imported, verified, and visible in route scoring. |
| 8 | More verified low-clearance bridge data | In progress | Low bridges in TX/OK/NM/AR are city/address enriched and supervisor verified where operationally important. |
| 9 | Hazard confidence/source tracking cleanup | Started | Hazards show source, confidence, verification state, and warning strength consistently. |
| 10 | Better off-route reroute flow | Started | Driver off-route behavior is clearer, logged, and reroute decisions are safer and reviewable. |

## Working Rule

Until all 10 items are complete, development should stay inside this list. Any new feature request should be classified as:

- Required by one of these 10 items
- Deferred until after production pilot
- Rejected as scope creep

## Item 1 Current Notes

Backend cloud deployment readiness now includes:

- Dockerfile
- Render blueprint
- `/health` endpoint
- `/ready` endpoint
- `npm.cmd run verify:production`
- `npm.cmd run check:deployed -- https://your-deployed-api.example`
- Expanded deployment documentation
- Required production environment variable list

Remaining for item 1:

- Choose/confirm the cloud host
- Add production environment variables in the host
- Deploy backend
- Confirm `/health` and `/ready`
- Run `npm.cmd run check:deployed -- https://your-deployed-api.example`
- Point mobile `EXPO_PUBLIC_API_BASE_URL` to the deployed backend

## Item 2 Current Notes

Delivery-note photo storage now uses a provider adapter and has been verified with Cloudflare R2:

- `PHOTO_STORAGE_PROVIDER=local` for development
- `PHOTO_STORAGE_PROVIDER=s3` for production S3-compatible object storage
- `PHOTO_STORAGE_PROVIDER=s3` is currently configured locally for Cloudflare R2
- `/health` reports the active photo storage provider
- `/ready` requires durable photo storage before production pilot
- `npm.cmd run verify:production` fails if production is still using local photo storage
- `npm.cmd run photos:verify-storage` verifies upload, public URL access, and cleanup
- `npm.cmd run photos:migrate` migrates existing local delivery-note photos into configured object storage

Remaining for item 2:

- Add the same R2 environment variables in the cloud backend host
- Add the object storage environment variables in the cloud host
- Run `npm.cmd run photos:migrate` after object storage is configured
- Upload and view a delivery-note photo after deployment

## Item 3 Current Notes

Admin authentication now supports named users stored in PostgreSQL:

- `admin_users` table
- `npm.cmd run admin:create`
- Admin Users dashboard page
- Per-user roles: `admin` or `supervisor`
- Existing shared password remains as a bootstrap fallback
- Production verification requires at least one active named admin user

Remaining for item 3:

- Create real supervisor/admin accounts in the production database
- Stop sharing one password between supervisors
- Decide which users have `admin` permissions for destructive actions
- Have supervisors sign in with their own accounts during field testing

## Item 4 Current Notes

Driver write actions now support a backend-validated request token:

- `DRIVER_API_TOKEN` on the backend
- `EXPO_PUBLIC_DRIVER_API_TOKEN` in the mobile app
- Driver identity headers: `X-TSR-Driver-Id`, `X-TSR-Driver-Name`, `X-TSR-Device-Id`
- Protected driver actions include safe-route requests, hazard reports, route replay events, and delivery-note edits
- Admin dashboard sessions can still perform admin delivery-note edits without the driver token
- Route sessions, route events, and driver hazard reports now capture driver identity when provided

Remaining for item 4:

- Set a production token before the pilot app build
- Rebuild the development/pilot app after adding `EXPO_PUBLIC_DRIVER_API_TOKEN`
- Later replace the shared driver app token with per-driver identity/session login

## Item 5 Current Notes

API key handling now has production checks:

- Backend production verifier requires server Google key, CORS, database, PostGIS, durable photo storage, driver token, and named admin users
- Android Maps SDK key is read from mobile environment variables at build time
- Mobile production verifier fails if the driver token is missing or if `app.json` contains a literal Google API key
- Backend and mobile `npm.cmd run verify:secrets` scans source files for live API keys/tokens
- Secret audits are included in production verification

Remaining for item 5:

- Add production secrets to EAS/hosted build environments
- Confirm Google key restrictions in Google Cloud for backend server key and Android app key
- Rebuild the pilot app after all build-time env vars are set
