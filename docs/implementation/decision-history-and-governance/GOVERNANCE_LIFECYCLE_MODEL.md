# Governance Lifecycle Model

Lifecycle states include RECORDED, PENDING_REVIEW, UNDER_REVIEW, APPROVED_FOR_TEST, APPROVED_WITH_CONDITIONS, REJECTED, HUMAN_REVIEW_REQUIRED, EXCEPTION_PENDING, EXCEPTION_GRANTED, STALE, SUPERSEDED, DEPRECATED, RETIRED, INVALID, and UNKNOWN. These are distinct from production activation.

## Boundary

AI-IEP-004A.7 is repository-only, synthetic, offline, append-only, and test-only. It does not modify runtime audit logging, expose public APIs, persist to a database, run migrations, deploy, call providers, create owner approval, grant production approval, certify compliance, approve procurement, or activate production runtime behavior.
