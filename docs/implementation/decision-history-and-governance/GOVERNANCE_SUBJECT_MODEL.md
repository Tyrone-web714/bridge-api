# Governance Subject Model

Subjects are typed references such as EXECUTION_DECISION_RECORD, DECISION_POLICY_PROFILE, SCORE_RUN, COST_GOVERNANCE_RUN, GENERATED_ARTIFACT, and IMPLEMENTATION_WORK_PACKAGE. A name alone is not identity; subject type, ID, version, hash, source path, lifecycle, test-only, and production applicability are explicit.

## Boundary

AI-IEP-004A.7 is repository-only, synthetic, offline, append-only, and test-only. It does not modify runtime audit logging, expose public APIs, persist to a database, run migrations, deploy, call providers, create owner approval, grant production approval, certify compliance, approve procurement, or activate production runtime behavior.
