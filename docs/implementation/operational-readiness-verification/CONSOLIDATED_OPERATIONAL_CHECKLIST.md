# Consolidated Operational Checklist

| Area | Status | Evidence | Required Next Action |
| --- | --- | --- | --- |
| Production DB state | READY | Owner manually completed approved read-only preflight against actual production PostgreSQL/PostGIS. `ok=true`, `readOnly=true`, PostGIS enabled, migrations `001`-`010` applied, ownership and driver identity checks passed. | Keep evidence attached; rerun only if production schema/data changes before rollout. |
| Production backup | READY WITH LIMITATION | Render PostgreSQL Recovery page verified PITR availability for `truck-safe-routing-db`; 3-day recovery window and on-demand logical export capability observed. | Separately approve restore rehearsal before production rollout GO. |
| Restore capability | NOT VERIFIED | Render PITR restore path is available, but no production restore rehearsal was performed. | Restore a recent PITR point to a separate non-production database after separate owner approval. |
| Render environment | READY WITH LIMITATION | `render.yaml`, deployed `/health`, and deployed `/ready` confirm runtime dependency readiness; actual Render dashboard/API variable inventory was not inspected. | Verify variables by name in Render dashboard/API without revealing values. |
| Object storage | READY WITH LIMITATION | Deployed `/health` reports durable `s3` photo storage configured. | Run approved disposable upload/read/denial smoke. |
| Monitoring and alerting | READY WITH LIMITATION | Application health, readiness, audit, and error logging exist. | Configure active external monitoring and alert routing. |
| Mobile offline/reconnect replay | NOT VERIFIED | Prior mobile tenant validation exists; this full offline replay was not physically executed in this phase. | Execute physical-device test on current pilot APK. |
| Browser dashboard walkthrough | NOT VERIFIED | Contract tests exist; no admin credentials/browser session were available. | Perform authenticated browser walkthrough with approved test accounts. |
| Deployed Render smoke | READY WITH LIMITATION | `/health` 200, `/ready` 200, admin login page 200 HTML, `/api/admin` and `/api/route-manifests/admin` redirect to login, protected JSON APIs return 401. | Verify deployed commit/schema alignment and authenticated workflows. |
| Migrations `006`-`010` | READY WITH LIMITATION | Production read-only preflight verifies migrations `001`-`010` are applied and expected foundation tables are present. | Backup, restore plan, deployment alignment, and authenticated smoke remain required before rollout. |
| Tenant isolation | READY WITH LIMITATION | Automated foundation tests pass; production ownership checks passed for core operational tables. | Complete authenticated role/dashboard smoke and monitor for tenant-isolation denials. |
| Authentication | READY WITH LIMITATION | Automated auth/RBAC and Enterprise Identity foundation tests pass. | Browser/device authentication smoke still required. |
| Data Lifecycle | READY WITH LIMITATION | ODR-019 foundation validated; purge execution disabled for production unless explicitly enabled. | Verify production policy configuration before enabling lifecycle jobs. |
| Enterprise Identity | READY WITH LIMITATION | ODR-020 foundation validated; provider verification paused. | Continue to provider verification only after operational blockers close. |

## Consolidated Prior Findings

Items identified in previous reports as `OPERATIONAL_VERIFICATION_REQUIRED`, `OWNER APPROVAL REQUIRED`, `READY WITH LIMITATION`, or `NOT VERIFIED` were consolidated into this package. The deployed public smoke checks are stronger after this closure pass, and the approved production read-only preflight now verifies production schema state through migration `010`. The highest blockers remain restore rehearsal evidence, mobile offline replay, authenticated dashboard walkthrough, object-storage disposable mutation approval, monitoring evidence, deployed commit alignment, and remaining Render/provider operational evidence.
