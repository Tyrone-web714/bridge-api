# Deployed Render Smoke Results

Status: PASSED WITH LIMITATION.

Target: `https://truck-safe-routing-api.onrender.com`

## Render Service Evidence

| Item | Result |
| --- | --- |
| Service | `truck-safe-routing-api` |
| Service ID | `srv-d88mcejbc2fs73ecv8b0` |
| Runtime | Docker |
| Region | Oregon |
| Branch | `main` |
| Latest deployed commit | `632709e0ee9adf934c4f157017fbbfaf9a158872` |
| Latest deployed message | `Validate and harden Enterprise Identity foundation` |
| Deploy status | Live |

## Public Smoke Results

`npm.cmd run check:deployed -- https://truck-safe-routing-api.onrender.com` passed.

| Check | Result |
| --- | --- |
| `/health` | HTTP 200 |
| `/ready` | HTTP 200 |
| database | PostgreSQL |
| PostGIS | true |
| driver auth | configured |
| photo storage provider | `s3` |
| photo storage configured | true |
| photo storage durable | true |
| Google Maps key | ready |
| admin password and secret | ready |

Prior unauthenticated access checks also passed:

| Check | Result |
| --- | --- |
| `/api/routing/manual-hazards/admin/login` | HTTP 200 HTML |
| `/api/admin` unauthenticated | HTTP 302 redirect to `/api/routing/manual-hazards/admin/login` |
| `/api/route-manifests/admin` unauthenticated | HTTP 302 redirect to `/api/routing/manual-hazards/admin/login` |
| `/api/driver-auth/session` unauthenticated | HTTP 401 JSON |
| `/api/enterprise-identity/providers` unauthenticated | HTTP 401 JSON |

## Limitations

- `CORS_ORIGIN` wildcard drift was found in Render environment configuration and must be remediated before production rollout GO.
- Authenticated admin, dashboard, driver, warehouse, and mobile flows were not tested in this phase.
- No deployment was triggered.
- No object-storage mutation smoke was performed.
