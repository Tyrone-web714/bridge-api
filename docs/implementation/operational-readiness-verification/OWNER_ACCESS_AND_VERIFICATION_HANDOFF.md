# Owner Access And Verification Handoff

Status: Required owner/external-access handoff.

This document lists the remaining production-readiness blockers that cannot be closed from source code alone. These are external access and operational verification blockers, not confirmed source-code defects.

Do not paste full secret values into Git, documentation, chat, screenshots, or tickets. Provide only redacted metadata and pass/fail evidence unless Codex specifically needs a temporary secret in the local execution environment.

## Remaining Blocker Table

| Blocker | Required Access | Owner Action | Evidence Needed | Codex Can Continue After |
| --- | --- | --- | --- | --- |
| Production PostgreSQL/PostGIS database | Completed by owner-run read-only preflight | No further action unless schema/data changes before rollout. | `ok=true`, `readOnly=true`, PostgreSQL 18.4, PostGIS enabled, migrations `001`-`010` applied, ownership and driver identity checks passed. | Production DB state is now verified. |
| Production database backups | Render PostgreSQL dashboard | Render provider, PITR availability, 3-day recovery window, encryption-by-documentation, and on-demand logical export capability were verified. | Dashboard text summary with no secrets. | Backup provider/PITR capability confirmed; latest discrete backup timestamp not exposed and no logical export currently exists. |
| Production restore capability | Render PostgreSQL plus separate restored database | Completed PITR restore rehearsal into `tsr-restore-rehearsal-20260718`. Do not restore over production. | Restore target metadata, restore timestamp, schema/PostGIS result, representative counts. | PASSED; temporary restore cleanup remains an owner decision. |
| Render environment variables | Render dashboard for service `truck-safe-routing-api` | Variable names and safe metadata verified without exposing secret values. | Variable-name checklist recorded. | PASSED WITH LIMITATION; High drift: `CORS_ORIGIN` wildcard must be replaced with approved explicit origins. |
| Deployed commit/version | Render service deployment page | Connected repo, branch, latest deployed commit, root directory, health path, and deployment status verified. | Commit SHA, branch, root directory, latest deploy result. | PASSED; deployed commit matches `origin/main`. |
| Object storage | Render env names plus S3-compatible storage provider dashboard | Confirm bucket/container, credentials, tenant prefix strategy, disposable test prefix, upload/read/delete permissions. | Provider name if known, bucket name or redacted bucket ID, disposable prefix, permission result. | Owner approves a disposable object smoke or provides provider-side evidence. |
| Monitoring and alerting | Render notifications/logs and any external monitor/alert provider | Verify active monitoring and alert routing for health, readiness, DB, error rate, auth failures, deployment failures. | Monitor names, alert destinations, last test alert/result. | Monitoring matrix can be marked verified or gaps documented. |
| Physical mobile offline/reconnect validation | Physical Android device with current pilot APK and test route | Execute manual device scenario and capture evidence. | Device model, Android version, app version/build, route ID, screenshots/video, sync result. | Full scenario result and any defects are returned. |
| Authenticated dashboard walkthrough | Approved test credentials for Supervisor, Organization Admin, Platform Admin, Warehouse | Walk deployed dashboard pages with test records only. | Role used, pages checked, screenshots, pass/fail notes, no secret passwords. | Role/page matrix results are returned. |

## Minimum Information Needed To Resume

1. Render service deployment metadata: connected repo, branch, deployed commit SHA, root directory, latest deploy status.
2. Database backup evidence: Render PostgreSQL PITR verified with 3-day recovery window; restore rehearsal still required.
3. Restore rehearsal evidence recorded; temporary restored database cleanup remains for owner review.
4. Render environment variable name checklist recorded; CORS wildcard drift remains.
5. Object storage provider/bucket/prefix evidence and whether a disposable object smoke is approved.
6. Monitoring/alerting provider evidence and alert destination test result.
7. Mobile offline/reconnect test evidence.
8. Authenticated dashboard walkthrough evidence.

## A. Production PostgreSQL/PostGIS Database

### Production Preflight Result

The approved non-destructive production database preflight was completed manually by the owner against the actual TSR production PostgreSQL/PostGIS database.

Verified:

- `ok=true`
- `readOnly=true`
- PostgreSQL 18.4
- PostGIS enabled
- `schema_migrations` exists
- migrations `001` through `010` are recorded as applied
- no expected migrations are missing
- core Organization ownership checks passed
- driver internal identity and duplicate Organization/company driver number checks passed
- foundation tables exist through BI/KPI, Logistics Intelligence, FISS, Data Lifecycle, and Enterprise Identity

Important note:

- `organization_memberships` currently contains zero rows. This is acceptable for native admin/driver/warehouse authentication, but existing internal users should eventually receive approved Organization membership records before Enterprise Identity federation is enabled for those users.

### Where The Production `DATABASE_URL` Is Expected To Come From

Repository evidence shows `DATABASE_URL` is a Render environment variable:

- file: `render.yaml`
- service: `truck-safe-routing-api`
- variable: `DATABASE_URL`
- configuration: `sync: false`

Because `sync: false` is used, the production value is intentionally not stored in Git. The production database provider cannot be proven from repository contents. Public `/health` confirms PostgreSQL and PostGIS are active on the deployed service, but it does not reveal the provider or connection target.

### Owner Steps In Render

1. Open Render.
2. Open the web service named `truck-safe-routing-api`.
3. Open `Environment`.
4. Confirm `DATABASE_URL` exists.
5. Do not reveal or paste the full value.
6. Identify only:
   - provider name, if visible
   - database name
   - host
   - port
   - SSL requirement
   - whether the database is production
7. Open the database provider dashboard, if Render links to one, and confirm PostGIS support if visible.

### Owner Confirmation Checklist

| Item | Owner Result |
| --- | --- |
| Provider name |  |
| Database name |  |
| Host |  |
| Port |  |
| SSL required |  |
| PostGIS enabled |  |
| Confirmed production target |  |

### Safest Way To Make `DATABASE_URL` Available To Codex

Preferred safe methods:

1. Owner runs the read-only preflight locally or in Render Shell and shares the JSON report.
2. Owner temporarily sets `DATABASE_URL` and `DATABASE_SSL` only in the current PowerShell session used by Codex, then Codex runs `npm.cmd run production:db:preflight`.
3. Owner provides a temporary least-privilege read-only database user for validation and revokes it after verification.

Never commit `.env` changes. Never paste the full connection string into documentation. Never print the value in command output.

## B. Production Database Backups

Provider identification is complete: the production database is Render PostgreSQL resource `truck-safe-routing-db` (`dpg-d88mpah9rddc738jl2tg-a`) on the `Basic-1gb` plan in Oregon (US West).

Verified backup facts:

- Render PostgreSQL Recovery page is available.
- Point-in-Time Recovery is available for the past 3 days.
- On-demand logical exports are available.
- The export table currently shows 0 files.
- Render documentation states paid PostgreSQL databases are continuously backed up for PITR.
- Render documentation states PostgreSQL databases, replicas, and backups are encrypted at rest with AES-256, and external connections use Render-managed TLS.

Still not visible or not performed:

- a discrete most-recent successful backup timestamp
- an actual logical export
- an actual restore rehearsal

Evidence now recorded:

- provider name: Render PostgreSQL
- backup enabled: yes, through Render PITR
- last successful backup timestamp: not exposed as a discrete timestamp in the dashboard
- retention: PITR past 3 days; logical exports retained at least 7 days after creation
- PITR: yes
- encryption: Render documentation says AES-256 at rest and TLS in transit
- restore method summary: PITR restore creates a new database instance for validation before cutover
## C. Production Restore Capability

Preferred test:

1. In the database provider, choose a recent successful production backup.
2. Restore it into a separate non-production database.
3. Do not restore over production.
4. Confirm PostgreSQL compatibility.
5. Confirm PostGIS.
6. Confirm representative row counts.
7. Confirm migrations/schema structures.
8. Run read-only application readiness checks against the restore if access is approved.

Evidence to send back:

- restore source backup timestamp
- restore target name
- restore completion status
- PostGIS result
- representative table count summary
- whether `/health` and `/ready` passed against restored data, if app smoke was performed

## D. Render Environment Variables

Owner should open:

- Render service: `truck-safe-routing-api`
- page: `Environment`

Report only `PRESENT`, `MISSING`, or `NOT VERIFIED`.

Required names:

| Variable | Status |
| --- | --- |
| `NODE_ENV` |  |
| `DATABASE_URL` |  |
| `DATABASE_SSL` |  |
| `GOOGLE_MAPS_API_KEY` |  |
| `ADMIN_DASHBOARD_PASSWORD` |  |
| `ADMIN_DASHBOARD_SECRET` |  |
| `ADMIN_DASHBOARD_ADMINS` |  |
| `ADMIN_DASHBOARD_ROLE` |  |
| `DRIVER_API_TOKEN` |  |
| `ALLOW_LEGACY_DRIVER_API_TOKEN` |  |
| `CORS_ORIGIN` |  |
| `BACKEND_PUBLIC_URL` |  |
| `PHOTO_STORAGE_PROVIDER` |  |
| `PHOTO_STORAGE_BUCKET` |  |
| `PHOTO_STORAGE_REGION` |  |
| `PHOTO_STORAGE_ENDPOINT` |  |
| `PHOTO_STORAGE_FORCE_PATH_STYLE` |  |
| `PHOTO_STORAGE_ACCESS_KEY_ID` |  |
| `PHOTO_STORAGE_SECRET_ACCESS_KEY` |  |
| `PHOTO_STORAGE_PUBLIC_BASE_URL` |  |
| `OPENAI_API_KEY` |  |
| `OPENAI_MODEL` |  |
| `ALLOW_PRODUCTION_LIFECYCLE_PURGE` |  |

Dangerous settings to flag:

- `NODE_ENV` not `production`
- `DATABASE_URL` points to localhost/private development database
- `CORS_ORIGIN=*`
- `ALLOW_LEGACY_DRIVER_API_TOKEN=true`
- missing admin session secret
- missing object-storage settings
- `ALLOW_PRODUCTION_LIFECYCLE_PURGE=true` without explicit rollout approval
- unexpected debug/test flags

## E. Deployed Commit / Version

Owner should open:

- Render service: `truck-safe-routing-api`
- page: `Events`, `Deploys`, or latest deployment detail

Verify:

- connected GitHub repository
- branch
- latest deployed commit SHA
- deployment ID
- deployment timestamp
- root directory
- build command
- start command
- health-check path
- auto-deploy enabled/disabled
- latest deployment result

Safe information to send back:

- repo URL
- branch
- commit SHA
- deploy ID
- deploy time
- root directory
- build/start command text
- health-check path
- auto-deploy status
- latest deploy status

## F. Object Storage

Repository evidence shows the storage layer is S3-compatible and vendor-abstracted. `render.yaml` includes:

- `PHOTO_STORAGE_PROVIDER`
- `PHOTO_STORAGE_BUCKET`
- `PHOTO_STORAGE_REGION`
- `PHOTO_STORAGE_ENDPOINT`
- `PHOTO_STORAGE_FORCE_PATH_STYLE`
- `PHOTO_STORAGE_ACCESS_KEY_ID`
- `PHOTO_STORAGE_SECRET_ACCESS_KEY`
- `PHOTO_STORAGE_PUBLIC_BASE_URL`

The provider is not proven from repository contents.

Owner should verify in Render and the storage provider:

- provider name
- bucket/container exists
- credentials are present in Render
- public base URL is configured
- tenant path/prefix strategy is documented
- disposable test prefix exists or can be created
- upload permission exists
- authorized read works
- unauthorized read is denied
- delete permission for disposable objects is safe
- lifecycle/tombstone behavior is understood

Do not run upload/delete smoke without separate explicit approval.

## G. Monitoring And Alerting

Owner should identify whether monitoring is provided by Render, an external uptime tool, or another platform.

Verify:

| Condition | Expected Verification |
| --- | --- |
| Application unavailable | active monitor or alert |
| `/health` failure | active monitor or alert |
| `/ready` failure | active monitor or alert |
| database connectivity failure | alert or runbook |
| high API error rate | alert or log query |
| authentication failure spike | alert or log query |
| authorization denial spike | alert or log query |
| tenant-isolation denial | alert or log query |
| deployment failure | Render notification or alert |
| migration failure | release alert/runbook |
| object-storage failure | alert or log query |
| Shared Safety failure | alert or log query |
| BI/KPI failure | alert or log query |
| Logistics Intelligence failure | alert or log query |
| FISS failure | alert or log query |

Evidence to send back:

- provider/tool name
- monitor names
- alert destinations
- last test alert result
- gaps marked `NOT CONFIGURED`

## H. Physical Mobile Offline/Reconnect Validation

Use a physical Android device with the latest relevant non-production APK.

Record:

- device model
- Android version
- package name
- app version/build
- APK/build identifier or commit if visible
- test driver ID
- route number/date

Steps:

1. Login as test Driver A.
2. Load assigned route.
3. Confirm map/basemap.
4. Confirm route line.
5. Confirm truck marker.
6. Turn off network.
7. Complete one stop.
8. Add one delivery operation.
9. Add one note.
10. Record route events.
11. Add inventory/closeout data where supported.
12. Restart the app while still offline.
13. Confirm queued work persists.
14. Reconnect.
15. Confirm each queued operation syncs exactly once.
16. Confirm no duplicate submissions.
17. Confirm failed items remain recoverable.
18. Confirm Driver B cannot view Driver A local data.
19. Confirm another Organization cannot sync Driver A queue.
20. Confirm deactivated/revoked identity cannot replay queued operations.

Evidence to send back:

- screenshots/video of route loaded, offline queue, restart, reconnect, and synced state
- route number/date
- stop ID or stop name used
- whether any duplicate appeared
- any error messages

## I. Authenticated Browser Dashboard Walkthrough

Use approved test credentials only. Do not use destructive production records.

### Supervisor

Verify:

- login
- Daily Route Manifest
- Supervisor Dashboard
- driver list
- route assignment
- route progress
- delivery notes/photos
- operational dashboards
- KPI dashboard
- Logistics Intelligence Decision Center
- FISS views

Expected result: pages render as HTML, no redirect loops, permissions match Supervisor role, Organization-private data remains scoped.

### Organization Admin

Verify:

- user/driver management
- KPI configuration
- dashboards
- Organization-private Shared Safety workflow

Expected result: Organization Admin can manage only its Organization and cannot access Platform Admin functions.

### Platform Admin

Verify:

- Shared Safety moderation
- support/admin access
- audited cross-Organization actions

Expected result: Platform Admin-only pages are protected and support access is auditable.

### Warehouse

Verify:

- warehouse login
- departure workflow
- return workflow

Expected result: warehouse workflows require approved warehouse authentication and do not grant admin access.

Evidence to send back:

- role used
- pages checked
- pass/fail per page
- screenshots with secrets/customer-sensitive data hidden
- any unexpected JSON auth errors or redirect loops
