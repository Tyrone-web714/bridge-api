# Decision History Architecture

Execution Decision Records are copied into immutable Decision Snapshots, wrapped by Decision History Records, linked to append-only Governance Events, and projected into current governance state. Generated reports expose lineage, replay, review, approval, exception, finding, and attestation evidence.

## Boundary

AI-IEP-004A.7 is repository-only, synthetic, offline, append-only, and test-only. It does not modify runtime audit logging, expose public APIs, persist to a database, run migrations, deploy, call providers, create owner approval, grant production approval, certify compliance, approve procurement, or activate production runtime behavior.
