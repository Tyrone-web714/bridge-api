# Architecture

AI-IEP-004A.9 Dashboard Data Generation is repository-only, deterministic, offline, provider-neutral, database-neutral, read-only, hash-aware, lifecycle-aware, and test-only. It does not build UI, expose APIs, invoke providers, route vehicles, change policies, alter decisions, approve governance, write databases, deploy, migrate, or change runtime behavior.

The generator consumes existing repository evidence from capability registry, benchmark datasets, evaluation, scoring, cost governance, execution decisions, decision governance, knowledge graph, generated artifacts, documentation metadata, package metadata, and repository inventory. It materializes datasets only through local scripts.
