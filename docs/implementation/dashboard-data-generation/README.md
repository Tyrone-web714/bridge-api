# Dashboard Data Generation

AI-IEP-004A.9 Dashboard Data Generation is repository-only, deterministic, offline, provider-neutral, database-neutral, read-only, hash-aware, lifecycle-aware, and test-only. It does not build UI, expose APIs, invoke providers, route vehicles, change policies, alter decisions, approve governance, write databases, deploy, migrate, or change runtime behavior.

This framework generates deterministic dashboard datasets for future presentation layers without making dashboards a source of truth.

Primary files: bridge-api/services/intelligenceExecution/dashboardDataGeneration.js, bridge-api/scripts/generate-dashboard-data-artifacts.cjs, bridge-api/scripts/check-dashboard-data-generation.cjs, and bridge-api/dashboard-data/.
