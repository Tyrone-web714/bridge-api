# D1 Data Minimization And Security

Status: SECURITY_REQUIREMENTS_DEFINED

D1 should ingest only data needed for Wave-1 prediction readiness.

## Field Classification

| Data type | Classification | Guidance |
| --- | --- | --- |
| Organization ID | REQUIRED_FOR_WAVE1 | Required for tenant isolation. |
| Route IDs/date/planned timings | REQUIRED_FOR_WAVE1 | Needed for route completion and stop context. |
| Actual route/stop timestamps | REQUIRED_FOR_WAVE1_TARGET | Target or post-outcome only. |
| Delivery status/outcome code | REQUIRED_FOR_WAVE1_TARGET | Preserve source and canonical values. |
| Account stable ID/number | REQUIRED_FOR_DELIVERY_FAILURE | Prefer stable IDs over customer names. |
| Driver stable ID | OPTIONAL_APPROVED | Avoid names unless needed for reconciliation. |
| Vehicle stable ID | SENSITIVE_REQUIRES_JUSTIFICATION | Include only when approved. |
| Customer names/addresses | SENSITIVE_REQUIRES_JUSTIFICATION | Avoid in representative datasets when stable account/stop IDs suffice. |
| Free-form notes | NOT_REQUIRED_BY_DEFAULT | Exclude unless approved for taxonomy mapping review. |
| Images/photos/media | PROHIBITED | Not needed for Wave 1. |
| Payment/card/bank data | PROHIBITED | Not needed for Wave 1. |
| Credentials/secrets | PROHIBITED | Never accepted. |

## Security Requirements

- Private-by-default import endpoints.
- RBAC-protected supervisor/admin access.
- Least-privilege import role.
- Audit logging for dry-run, approval, import, and quarantine review.
- Tenant isolation enforced before validation acceptance.
- No public historical-import endpoint.
- No raw private operational records committed to Git.
