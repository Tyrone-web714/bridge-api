# Monitoring and Alerting Follow-up

## Current Status

READY WITH LIMITATION.

Source and operational documentation identify the checks needed for private media shutdown, but alert delivery and post-shutdown monitoring behavior have not been fully proven during this final analysis.

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
