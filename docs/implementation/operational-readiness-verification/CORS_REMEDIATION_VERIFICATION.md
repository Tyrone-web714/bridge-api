# CORS Remediation Verification

Status: PASSED.

Date: 2026-07-18.

## Scope

This verification remediated the confirmed production `CORS_ORIGIN=*` drift for the Render service `truck-safe-routing-api`.

The change was limited to the production Render environment variable `CORS_ORIGIN`. No application code, database schema, migration, production data, object-storage data, or unrelated Render setting was changed.

## Intended Production Browser Origin

The only verified production browser origin requiring CORS authorization is:

- `https://truck-safe-routing-api.onrender.com`

Basis:

- The deployed supervisor/admin dashboard is server-rendered by the same backend service.
- The production backend public URL is `https://truck-safe-routing-api.onrender.com`.
- No separate production React/web dashboard origin was found in the deployed architecture.
- React Native/mobile clients do not require browser CORS authorization.
- Local development origins are not approved for production CORS.

## Render Configuration Change

| Item | Result |
| --- | --- |
| Service | `truck-safe-routing-api` |
| Service ID | `srv-d88mcejbc2fs73ecv8b0` |
| Previous `CORS_ORIGIN` | `*` |
| New `CORS_ORIGIN` | `https://truck-safe-routing-api.onrender.com` |
| Latest Render action | Environment |
| Latest deployed commit | `632709e0ee9adf934c4f157017fbbfaf9a158872` |
| Latest deploy status | Live |
| Latest environment deploy duration observed | 27.8s |

Render masked environment values in the dashboard after save. Active deployed behavior was therefore verified through production HTTP CORS responses.

## CORS Behavior Verification

Target: `https://truck-safe-routing-api.onrender.com`.

| Check | Result |
| --- | --- |
| Approved origin `/health` | HTTP 200; `Access-Control-Allow-Origin: https://truck-safe-routing-api.onrender.com` |
| Unapproved origin `/health` | HTTP 200; no `Access-Control-Allow-Origin` header |
| No-Origin `/health` | HTTP 200; no `Access-Control-Allow-Origin` header |
| `/ready` without Origin | HTTP 200 |
| Protected driver session with approved Origin | HTTP 401; `Access-Control-Allow-Origin: https://truck-safe-routing-api.onrender.com` |
| Approved preflight to `/api/driver-auth/session` | HTTP 204; `Access-Control-Allow-Origin: https://truck-safe-routing-api.onrender.com` |
| Unapproved preflight to `/api/driver-auth/session` | no `Access-Control-Allow-Origin` header |
| Wildcard ACAO returned | No |
| Credentialed CORS | `Access-Control-Allow-Credentials` not returned |

The unapproved-origin request still reaches public `/health`, but it is not authorized for browser CORS because no `Access-Control-Allow-Origin` header is returned. CORS remains separate from authentication and authorization.

## Deployed Health And Readiness

`npm.cmd run check:deployed -- https://truck-safe-routing-api.onrender.com` passed after remediation.

| Check | Result |
| --- | --- |
| `/health` | HTTP 200 |
| `/ready` | HTTP 200 |
| database | PostgreSQL |
| PostGIS | true |
| driver auth | configured |
| photo storage | `s3`, configured, durable |

## Production Verification Tooling

The repository production verification tooling rejects `CORS_ORIGIN='*'` for production. The CORS-specific failure condition is now closed by Render behavior evidence showing explicit-origin CORS responses and no wildcard ACAO.

Full `npm.cmd run verify:production` was not executed against the live production environment during this remediation because that script performs database setup/ensure checks and this task did not authorize production schema-touching operations.

## Safety

Production data modified: no.

Production migrations applied: no.

Application code deployed: no.

Render restart/redeploy occurred: yes, configuration-triggered Environment deploy only.

Secrets printed or committed: no.

Unrelated Render configuration changed: no evidence of unrelated changes; the operator action was limited to the `CORS_ORIGIN` row.

## Result

The CORS wildcard High-severity blocker is CLOSED.
