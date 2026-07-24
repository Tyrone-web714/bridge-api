# Monitoring and Alerting Follow-up

## Current Status

PILOT BLOCKER - ALERT DELIVERY NOT VERIFIED.

Source and operational documentation identify the checks needed for private media shutdown, and production `/health` and `/ready` both return HTTP 200. Render is configured to health-check `/health`, and deployment failure notification delivery is now verified by owner evidence from the failed `b449ee2` production deploy on July 19, 2026. Render workspace email notification destination is verified, and Render notifications are set to ALL NOTIFICATIONS. Database observability is verified through available Render metrics. Database metric-threshold alert delivery, external uptime alerts, and post-shutdown media-route monitoring remain unverified or deferred.

## Required Signals

Monitor at minimum:

- `/api/media` 401/403/404/5xx rates;
- delivery-note save failures;
- mobile photo upload failures;
- R2 read failures from the backend;
- admin Delivery Notes image failures;
- Cloudflare R2 access-setting changes;
- unexpected direct public URL creation after writer remediation.

## Required Follow-up

Before public R2 shutdown, verify that operational alerts are delivered to the expected owner channel and that a rollback owner is available during the shutdown window.

## Owner Actions Required

1. In Render, open the workspace that owns `truck-safe-routing-api`.
2. Open **Integrations** then **Notifications**.
3. Confirm the workspace notification destination and default service notification level. Do not document the private destination value.
4. Open `truck-safe-routing-api` then **Settings** and confirm the Health Check path is `/health`.
5. Confirm running-service unhealthy/failure notifications are enabled or otherwise routed to the owner/operator.
6. Open `truck-safe-routing-db` and inspect **Events**, **Metrics**, **Recovery**, and any notification/integration settings for database-critical events.
7. Confirm whether an external uptime monitor currently exists for `/health`.
8. Confirm whether an external uptime monitor currently exists for `/ready`.
9. After separate approval, send a safe test notification if Render or the uptime service supports it.
10. Document the destination type without exposing personal addresses, tokens, phone numbers, or webhook secrets.

## Classification

| Gap | Classification |
| --- | --- |
| Owner/operator alert delivery for service failure | Configured through Render ALL NOTIFICATIONS; not outage-tested |
| Owner/operator alert delivery for deployment failure | VERIFIED |
| Owner/operator alert delivery for database failure | Database observability verified; metric-threshold delivery not independently verified |
| External uptime monitor for `/health` | DEFERRED for later setup |
| External uptime monitor for `/ready` | DEFERRED for later setup |
| `/api/media` error-rate alerting | Required before public R2 shutdown |
| CPU/memory/resource threshold alerts | PRODUCTION SCALE REQUIREMENT |
| Centralized log aggregation and dashboards | PRODUCTION SCALE REQUIREMENT |
| Formal on-call schedule | FUTURE ENHANCEMENT |

## `/health` And `/ready`

Render should keep `/health` as the service health check. `/ready` should be monitored separately because it checks production dependencies and is the better signal for operational readiness.

## Current R2 Hardening Gate Decision

The current monitoring state is sufficient to proceed with merging and deploying the pre-shutdown remediation so production stops generating new `legacyPublicUrl` metadata. It is not sufficient to approve disabling public R2.
