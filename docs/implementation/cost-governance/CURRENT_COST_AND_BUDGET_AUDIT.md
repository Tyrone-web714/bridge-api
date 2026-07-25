# CURRENT COST AND BUDGET AUDIT

Existing reusable surfaces: services/intelligenceExecution/money.js already parses and formats micro-USD using BigInt; evaluation runs contain usage, duration, retryCount, and cost observations; scoring keeps cost observability separate from cost optimization.

Existing AI provider logic exposes estimatedCostUsd from environment-configured rates, but that remains legacy provider metadata and is not merged into Cost Governance production policy.

Existing billing-related service terms, invoice import fields, RBAC billing permission names, rate limits, object storage costs, and quota messages are unrelated to AI-IEP Cost Governance and remain separate.

No existing production budget enforcement, real provider pricing catalog, Organization billing model, customer invoicing model, or AI procurement decision is reused or modified.

Production behaviors that must not change include runtime planner behavior, provider adapter boundaries, scoring behavior, capability and dataset lifecycle, migrations, object storage, billing/invoice imports, and tenant isolation.
