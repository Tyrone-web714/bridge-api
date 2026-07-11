# API Audit

## Inventory

See `api-endpoints.csv` for generated static endpoint inventory.

## Summary

Current APIs are mounted under `/api/*`; Volume V requires versioned APIs such as `/api/v1`. Admin, driver, AI, places, operational, and route-manifest endpoints share one Express app.

## Findings

- TSR-AUD-002 Critical: no verified Organization scope across endpoint inventory. Impact: unsafe multi-tenant API exposure. Phase 5.
- High: versioned API contract is missing. Related architecture: Volume V API standards.
- High: bulk import/export/report endpoints require tenant and permission controls.
- High: driver endpoints accepting manifest/stop/account IDs require IDOR testing.
- Medium: output filtering and pagination must be verified endpoint-by-endpoint.
- Medium: idempotency is inconsistent; mobile retry flows require server idempotency.

## Required API Protection Matrix

Every endpoint needs method, path, auth, permission, Organization scope, input schema, output filter, pagination, rate limit, audit event, idempotency key, and consumer.
