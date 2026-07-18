# Post-Deployment Smoke Test Plan

Prefer READ ONLY checks. Mutations require approved disposable test data.

| Test | Type | Notes |
| --- | --- | --- |
| `/health` | READ ONLY | Must return `ok=true`. |
| `/ready` | READ ONLY | Must return `ok=true`. |
| Admin login | READ ONLY/session | Use named admin account. |
| RBAC denial | READ ONLY | Confirm lower role denied platform action. |
| Tenant isolation denial | READ ONLY | Confirm wrong Organization cannot read private data. |
| Supervisor dashboard load | READ ONLY | Browser smoke. |
| Driver login | READ ONLY/session | Use approved test driver. |
| Assigned route read | READ ONLY | Use disposable test route if no active route exists. |
| Warehouse access | READ ONLY/session | Use approved test warehouse employee. |
| Shared Safety sanitized read | READ ONLY | Published shared record must exclude private source data. |
| BI/KPI dashboard | READ ONLY | Load scoped dashboard. |
| Logistics Intelligence | READ ONLY | List scoped recommendations. |
| FISS | READ ONLY | List scoped scores. |
| Mobile/backend connectivity | READ ONLY | Current APK points to deployed backend. |

Any route upload, stop completion, photo upload, or closeout validation is TEST-DATA MUTATION and requires explicit disposable data approval.
