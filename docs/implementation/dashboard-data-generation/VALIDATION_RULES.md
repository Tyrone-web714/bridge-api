# Validation Rules

AI-IEP-004A.9 Dashboard Data Generation is repository-only, deterministic, offline, provider-neutral, database-neutral, read-only, hash-aware, lifecycle-aware, and test-only. It does not build UI, expose APIs, invoke providers, route vehicles, change policies, alter decisions, approve governance, write databases, deploy, migrate, or change runtime behavior.

Validation rejects duplicate dashboard IDs, unknown schemas, nondeterministic generatedAt values, missing hashes, missing source references, production applicability, prohibited runtime fields, hash mismatches, and stale generated artifacts.
