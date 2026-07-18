# Consolidated Operational Checklist

| Area | Status | Evidence | Required Next Action |
| --- | --- | --- | --- |
| Production DB state | READY | Owner manually completed approved read-only preflight against actual production PostgreSQL/PostGIS. `ok=true`, `readOnly=true`, PostGIS enabled, migrations `001`-`010` applied, ownership and driver identity checks passed. | Keep evidence attached; rerun only if production schema/data changes before rollout. |
| Production backup | PASSED | Render PostgreSQL Recovery page verified PITR availability for `truck-safe-routing-db`; 3-day recovery window and on-demand logical export capability observed. | Keep backup evidence attached; rerun only if provider/plan changes before rollout. |
| Restore capability | PASSED | Render PITR restored `truck-safe-routing-db` to separate non-production database `tsr-restore-rehearsal-20260718`; read-only preflight returned `ok=true`. | Owner should review then suspend/delete temporary restored DB when no longer needed. |
| Render environment | PASSED WITH LIMITATION | Render dashboard variable names inspected; `DATABASE_URL` target and `DATABASE_SSL` safely verified; required config names present. High drift: wildcard `CORS_ORIGIN`. | Remediate CORS to explicit approved origins before production rollout GO. |
| Object storage | READY WITH LIMITATION | Deployed `/health` reports durable `s3` photo storage configured. | Run approved disposable upload/read/denial smoke. |
| Monitoring and alerting | READY WITH LIMITATION | Application health, readiness, audit, and error logging exist. | Configure active external monitoring and alert routing. |
| Mobile offline/reconnect replay | NOT VERIFIED | Prior mobile tenant validation exists; this full offline replay was not physically executed in this phase. | Execute physical-device test on current pilot APK. |
| Browser dashboard walkthrough | NOT VERIFIED | Contract tests exist; no admin credentials/browser session were available. | Perform authenticated browser walkthrough with approved test accounts. |
| Deployed Render smoke | PASSED WITH LIMITATION | `/health` 200, `/ready` 200, deployed commit `632709e` matches `origin/main`, and schema compatibility is verified through migrations `001`-`010`. | Remediate CORS drift and complete authenticated workflows. |
| Migrations `006`-`010` | PASSED | Production and restored-copy preflights verify migrations `001`-`010` are applied and expected foundation tables are present. | Rerun only if production schema changes before rollout. |
| Tenant isolation | READY WITH LIMITATION | Automated foundation tests pass; production ownership checks passed for core operational tables. | Complete authenticated role/dashboard smoke and monitor for tenant-isolation denials. |
| Authentication | READY WITH LIMITATION | Automated auth/RBAC and Enterprise Identity foundation tests pass. | Browser/device authentication smoke still required. |
| Data Lifecycle | READY WITH LIMITATION | ODR-019 foundation validated; purge execution disabled for production unless explicitly enabled. | Verify production policy configuration before enabling lifecycle jobs. |
| Enterprise Identity | READY WITH LIMITATION | ODR-020 foundation validated; provider verification paused. | Continue to provider verification only after operational blockers close. |

## Consolidated Prior Findings

Items identified in previous reports as `OPERATIONAL_VERIFICATION_REQUIRED`, `OWNER APPROVAL REQUIRED`, `READY WITH LIMITATION`, or `NOT VERIFIED` were consolidated into this package. The deployed public smoke checks are stronger after this closure pass, and the approved production read-only preflight now verifies production schema state through migration `010`. The highest blockers remain CORS wildcard remediation, mobile offline replay, authenticated dashboard walkthrough, object-storage disposable mutation approval, monitoring evidence, and temporary restore cleanup owner review.
