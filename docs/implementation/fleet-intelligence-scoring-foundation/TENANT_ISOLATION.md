# Tenant Isolation

Every FISS table includes `organization_id`.

All reads and calculations derive Organization context from the trusted server-side auth context. A client-supplied Organization ID cannot override tenant scope.

Scores are Organization-private unless a later approved anonymized benchmarking workflow is implemented.
