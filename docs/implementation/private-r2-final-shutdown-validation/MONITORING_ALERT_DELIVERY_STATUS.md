# Monitoring Alert Delivery Status

## Status

PILOT BLOCKER - ALERT DELIVERY NOT VERIFIED.

Production `/health` and `/ready` are currently reachable, and Render is configured to health-check `/health`. Deployment failure notification delivery is verified by owner evidence from a historical failed production deploy. Overall monitoring is not fully verified yet because running-service health failure notification delivery, database-critical notification delivery, external uptime monitoring, and media-route error-rate alerting remain unproven.

## Verification Evidence

| Evidence | Result |
| --- | --- |
| Render service | `truck-safe-routing-api` verified in prior Render environment evidence |
| Render database | `truck-safe-routing-db` verified in prior backup/restore evidence |
| Render blueprint health check | `render.yaml` sets `healthCheckPath: /health` |
| Production `/health` live check | HTTP 200, `application/json; charset=utf-8` |
| Production `/ready` live check | HTTP 200, `application/json; charset=utf-8` |
| Deployment failure notification delivery | VERIFIED by owner-received Render email for failed commit `b449ee2` on July 19, 2026 |
| Running-service health alert destination evidence | Not accessible in-session |
| Database-critical alert destination evidence | Not accessible in-session |
| External uptime monitor evidence | Not found in repository or supplied operational evidence |
| Safe test notification | Not executed; separate owner approval required |
| Outage/crash simulation | Not performed; prohibited for this phase |

## Verified Alert-Delivery Event

| Item | Verified result |
| --- | --- |
| Event type | Production deployment failure |
| Commit | `b449ee2` |
| Date | July 19, 2026 |
| Provider notification | Render sent an email notifying the owner that the deployment failed |
| Owner evidence | Owner personally received the email notification |
| Classification | VERIFIED |

This verifies deployment-failure notification delivery for the production Render service. It does not, by itself, verify running-service health failure alerts, database-critical alerts, external uptime alerts, or media-route error-rate alerts.

## Monitoring Classification Matrix

| Capability | Classification | Evidence | Pilot impact |
| --- | --- | --- | --- |
| Render web-service health detection for `/health` | CONFIGURED BUT DELIVERY NOT VERIFIED | `healthCheckPath: /health` and live `/health` HTTP 200 | Detection exists, but owner notification still unproven |
| Render `/ready` monitoring | AVAILABLE BUT NOT CONFIGURED | `/ready` returns HTTP 200, but Render health check targets `/health` only | Add external readiness monitor before unattended pilot |
| Render service unavailable / health-check failure alert delivery | CONFIGURED BUT DELIVERY NOT VERIFIED | Render health check configured; notification destination not inspected | PILOT BLOCKER until delivery is proven |
| Render deployment failure notifications | VERIFIED | Owner received Render email for failed production deploy at commit `b449ee2` on July 19, 2026 | Closed for minimum deployment-failure notification evidence |
| Render service crash/restart notifications | NOT ACCESSIBLE | Requires Render service events/notification settings; no outage created | PILOT BLOCKER until delivery is proven |
| Render CPU/memory/resource alerts | NOT ACCESSIBLE | Requires Render metrics/alert settings; no dashboard evidence captured | PRODUCTION SCALE REQUIREMENT |
| Render service logs/events | AVAILABLE BUT DELIVERY NOT VERIFIED | Render service exists; log/event alert routing not verified | PRODUCTION SCALE REQUIREMENT |
| Render PostgreSQL status/metric monitoring | NOT ACCESSIBLE | Database resource verified; database alert configuration not inspected | PILOT BLOCKER for database failure notification |
| Render PostgreSQL backup/recovery notifications | NOT ACCESSIBLE | PITR and restore capability verified; backup alert delivery not verified | PRODUCTION SCALE REQUIREMENT |
| External `/health` uptime monitoring | AVAILABLE BUT NOT CONFIGURED | No repository or operational evidence of an external uptime monitor | PILOT BLOCKER for unattended pilot |
| External `/ready` uptime monitoring | AVAILABLE BUT NOT CONFIGURED | `/ready` is live but no external monitor evidence was found | PILOT BLOCKER for unattended pilot |
| `/api/media` error-rate alerting | AVAILABLE BUT NOT CONFIGURED | Authenticated media route is implemented; no error-rate alert route verified | Required before public R2 shutdown |
| Cloudflare R2 bucket/security notifications | NOT ACCESSIBLE | Cloudflare dashboard/settings were not inspected | PRODUCTION SCALE REQUIREMENT |

## Owner Dashboard Verification Required

The owner or a person with provider access should verify these items without exposing credentials or tokens:

1. Open the Render Dashboard workspace that owns `truck-safe-routing-api`.
2. In the left navigation, open **Integrations** then **Notifications**.
3. Confirm the notification destination includes the owner/operator channel. Do not document the actual email address, phone number, webhook URL, or Slack destination.
4. Confirm **Default Service Notifications** is set to at least **Only failure notifications** or that `truck-safe-routing-api` has an equivalent service-level override.
5. Open the `truck-safe-routing-api` service, then open its **Settings** page.
6. In **Health Checks**, confirm the path is `/health`.
7. Inspect the service notification override, if present, and confirm notifications include failed deploys and running-service unhealthy/failure events.
8. Open `truck-safe-routing-db`.
9. Inspect the database **Events**, **Metrics**, **Recovery**, and any notification or integration settings available for the database resource.
10. Confirm whether database unavailable, backup/export failure, storage threshold, or high-connection/resource alerts are configured or available.
11. Confirm whether any external uptime provider currently monitors `https://truck-safe-routing-api.onrender.com/health`.
12. Confirm whether any external uptime provider currently monitors `https://truck-safe-routing-api.onrender.com/ready`.
13. If Render or the uptime monitor provides a safe test-notification button, request separate owner approval before using it.

## `/health` And `/ready` Monitoring Decision

Render should continue using `/health` as the platform health check because it confirms the web process can receive traffic and supports Render's deploy/runtime health gate.

`/ready` should be monitored separately by an external uptime or synthetic check because it verifies operational dependencies: PostgreSQL connectivity, PostGIS, Google Maps configuration, admin authentication configuration, durable photo storage, and driver authentication configuration.

Therefore:

- `/health` is sufficient for the Render service health check.
- `/ready` is not redundant; it remains required for controlled-pilot operational monitoring outside Render's single `healthCheckPath`.

## Minimum Controlled-Pilot Baseline

Before an unattended controlled pilot or public R2 shutdown:

1. Verify at least one owner/operator receives service-down or health-check failure notifications.
2. Verify at least one owner/operator receives deployment failure notifications. Current status: VERIFIED by the July 19, 2026 failed-deploy email for commit `b449ee2`.
3. Verify at least one owner/operator receives database failure notifications or has an equivalent monitored provider channel.
4. Configure external uptime probes for `/health` and `/ready`.
5. Add or verify an alert path for elevated `/api/media` 401/403/404/5xx rates after private R2 shutdown.

## Safe Test Notification

If Render, Cloudflare, or an uptime monitor provides a safe test-notification button, request separate owner approval before triggering it. Do not deliberately create an outage to test alerts.

## Shutdown Requirement

Before public R2 shutdown, confirm at least one owner/operator receives alerts for backend failure, deployment failure, database failure, and media-route elevated error rates.
