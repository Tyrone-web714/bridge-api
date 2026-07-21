# Monitoring and Alerting Follow-up

## Current Status

PILOT BLOCKER - ALERT DELIVERY NOT VERIFIED.

Source and operational documentation identify the checks needed for private media shutdown, and production `/health` and `/ready` both return HTTP 200. Render is configured to health-check `/health`, but actual alert delivery and post-shutdown monitoring behavior have not been fully proven during this final analysis.

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

1. Inspect Render notification settings for `truck-safe-routing-api`.
2. Confirm deployment failure, service failure, crash/restart, and health-check failure notifications reach the responsible owner/operator.
3. Inspect Render PostgreSQL notification settings for `truck-safe-routing-db`.
4. Configure external uptime checks for `/health` and `/ready`, or provide evidence that an external monitor already exists.
5. After separate approval, send a safe test notification if the provider or uptime service supports it.
6. Document the destination type without exposing personal addresses, tokens, phone numbers, or webhook secrets.

## Classification

| Gap | Classification |
| --- | --- |
| Owner/operator alert delivery for service failure | PILOT BLOCKER |
| Owner/operator alert delivery for deployment failure | PILOT BLOCKER |
| Owner/operator alert delivery for database failure | PILOT BLOCKER |
| External uptime monitor for `/health` | PILOT BLOCKER for unattended pilot |
| External uptime monitor for `/ready` | PILOT BLOCKER for unattended pilot |
| `/api/media` error-rate alerting | Required before public R2 shutdown |
| CPU/memory/resource threshold alerts | PRODUCTION SCALE REQUIREMENT |
| Centralized log aggregation and dashboards | PRODUCTION SCALE REQUIREMENT |
| Formal on-call schedule | FUTURE ENHANCEMENT |
