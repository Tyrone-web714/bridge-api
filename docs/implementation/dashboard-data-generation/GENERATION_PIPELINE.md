# Generation Pipeline

AI-IEP-004A.9 Dashboard Data Generation is repository-only, deterministic, offline, provider-neutral, database-neutral, read-only, hash-aware, lifecycle-aware, and test-only. It does not build UI, expose APIs, invoke providers, route vehicles, change policies, alter decisions, approve governance, write databases, deploy, migrate, or change runtime behavior.

The pipeline loads authoritative repository evidence, builds normalized dashboard projections, computes deterministic hashes, writes JSON/CSV/Markdown artifacts under dashboard-data/, and supports check mode for stale artifact detection.
