# Generated Artifacts

Generated artifacts live under docs/implementation/decision-history-and-governance/generated and are refreshed by npm run decision-governance:generate. The check command validates freshness.

## Boundary

AI-IEP-004A.7 is repository-only, synthetic, offline, append-only, and test-only. It does not modify runtime audit logging, expose public APIs, persist to a database, run migrations, deploy, call providers, create owner approval, grant production approval, certify compliance, approve procurement, or activate production runtime behavior.
