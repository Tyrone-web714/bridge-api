# Decision Governance Validation Rules

Validation rejects invalid schemas, duplicate IDs, unknown decisions, snapshot mutation, event-chain breaks, projection mismatch, production approval, certification claims, secret-like content, prohibited exceptions, and live replay execution.

## Boundary

AI-IEP-004A.7 is repository-only, synthetic, offline, append-only, and test-only. It does not modify runtime audit logging, expose public APIs, persist to a database, run migrations, deploy, call providers, create owner approval, grant production approval, certify compliance, approve procurement, or activate production runtime behavior.
