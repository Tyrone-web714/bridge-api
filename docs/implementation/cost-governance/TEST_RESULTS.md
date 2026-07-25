# TEST RESULTS

Local validation for AI-IEP-004A.5 must be rerun after every change before review.

Expected commands include node --check for cost-governance source and scripts, npm run cost-governance:generate twice, npm run cost-governance:validate, npm run cost-governance:check, npm run cost-governance:sensitivity, npm run test:cost-governance, AI-IEP foundation regression tests, and full npm test.

This document records repository-local validation only. It does not claim deployment, migration, production pricing, production budget enforcement, provider calls, or production smoke validation.

Controlled mutation expectations: stale generated artifacts fail, catalog mutation fails, budget mutation fails, cost record mutation fails, and prohibited best-value output fails.

Final command evidence should be captured in the session report before any source-control review.
