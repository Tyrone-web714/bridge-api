# Observability Requirements

Implemented:

- Application console logs.
- Request/audit event table.
- Auth/RBAC/security contract checks.
- Health/readiness endpoints.
- Runtime validation scripts.

Operational verification required:

- Render log access and retention.
- Alerting on `/ready` failure.
- Alerting on process restart loops.
- Database connection errors.
- Authentication failure spikes.
- Authorization/tenant denial spikes.
- Migration failure notification.
- Object storage upload failure notification.
- Shared Safety moderation errors.
- BI/KPI calculation failures.
- Logistics Intelligence processing failures.
- FISS calculation failures.

Minimum rollout monitoring:

- Render deploy logs during release.
- `/health` and `/ready` polling.
- API 5xx rate.
- Database connection failures.
- Authentication/RBAC denial anomaly review.
- Object storage errors.
