# Safety Model

The safety model is fail-first: production activation is prohibited, safety override is prohibited, critical gate failures block selection, and secret-like strings or private URLs invalidate artifacts.

## Boundary

AI-IEP-004A.6 is repository-only, synthetic, offline, advisory, and test-only. It does not deploy code, call live providers, write production data, mutate object storage, change cloud configuration, enforce production budgets, activate premium execution, or make procurement recommendations.
