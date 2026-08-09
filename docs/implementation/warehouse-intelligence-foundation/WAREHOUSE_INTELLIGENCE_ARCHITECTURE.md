# Warehouse Intelligence Architecture

A single deterministic module, `services/intelligenceExecution/warehouseIntelligence.js`, owns the repository-only Warehouse Intelligence foundation. It consumes synthetic route/load facts and existing TSR authority boundaries, then produces context, assignment, staging, loading, completeness, discrepancy, readiness, exception, alert, lifecycle, explanation, and generated evidence records.

Repository-only, synthetic, deterministic, provider-neutral, no production API, no production warehouse automation, no workforce scoring, no provider/model execution, no deployment, and no migration.
