# Governance Actor Model

Actors include SYSTEM, TEST_HARNESS, REVIEWER, OWNER, security/privacy/compliance reviewer classes, and UNKNOWN. Initial fixtures use synthetic system/reviewer actors and explicit UNKNOWN only; no real names, emails, credentials, or production authority are invented.

## Boundary

AI-IEP-004A.7 is repository-only, synthetic, offline, append-only, and test-only. It does not modify runtime audit logging, expose public APIs, persist to a database, run migrations, deploy, call providers, create owner approval, grant production approval, certify compliance, approve procurement, or activate production runtime behavior.
