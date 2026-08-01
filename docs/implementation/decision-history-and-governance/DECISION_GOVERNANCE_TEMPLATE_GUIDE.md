# Template Guide

Templates cover history records, events, policy profiles, review, approval, human review, exception, finding, attestation, annotation, replay, supersession, policy drift, and evidence staleness. Defaults are draft/recorded, test-only, and production-inapplicable.

## Boundary

AI-IEP-004A.7 is repository-only, synthetic, offline, append-only, and test-only. It does not modify runtime audit logging, expose public APIs, persist to a database, run migrations, deploy, call providers, create owner approval, grant production approval, certify compliance, approve procurement, or activate production runtime behavior.
