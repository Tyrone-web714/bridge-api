# Governance Event Types

Supported event classes cover creation, review, approval, rejection, human review, exceptions, lifecycle, evidence, replay, findings, attestations, and correction/annotation. Earlier events are never silently rewritten.

## Boundary

AI-IEP-004A.7 is repository-only, synthetic, offline, append-only, and test-only. It does not modify runtime audit logging, expose public APIs, persist to a database, run migrations, deploy, call providers, create owner approval, grant production approval, certify compliance, approve procurement, or activate production runtime behavior.
