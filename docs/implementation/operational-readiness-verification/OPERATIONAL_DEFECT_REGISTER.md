# Operational Defect Register

| ID | Severity | Status | Description | Evidence | Resolution |
| --- | --- | --- | --- | --- | --- |
| ODV-001 | Medium | Fixed | Production DB preflight did not include migrations `009` and `010`, so it could not report current ODR-019/ODR-020 production readiness. | `scripts/production-db-preflight.cjs` expected migrations stopped at `008`. | Updated read-only preflight expected migration/table inventory through `010`. |
| ODV-002 | High | Fixed | Production Render `CORS_ORIGIN` used wildcard `*`, which violates production security policy and verification tooling. | Render environment inspection and production CORS behavior before remediation. | Changed `CORS_ORIGIN` to `https://truck-safe-routing-api.onrender.com`; approved origin receives explicit ACAO, unapproved origin receives no ACAO, no wildcard ACAO is returned. |

## Remaining Defects

No unresolved Critical or High operational defects were confirmed from repository and read-only deployed smoke evidence in this phase.
