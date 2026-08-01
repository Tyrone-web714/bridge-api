# Evidence Staleness Detection

Evidence staleness is modeled as an event and reportable projection flag. Stale evidence does not silently invalidate or rewrite the original historical decision.

## Boundary

AI-IEP-004A.7 is repository-only, synthetic, offline, append-only, and test-only. It does not modify runtime audit logging, expose public APIs, persist to a database, run migrations, deploy, call providers, create owner approval, grant production approval, certify compliance, approve procurement, or activate production runtime behavior.
