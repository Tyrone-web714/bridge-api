# Runtime Non-Integration

The runtime planner remains the production execution planning boundary. The Decision Engine is a separate advisory module and is not invoked by production routes, health checks, readiness checks, or provider adapters.

## Boundary

AI-IEP-004A.6 is repository-only, synthetic, offline, advisory, and test-only. It does not deploy code, call live providers, write production data, mutate object storage, change cloud configuration, enforce production budgets, activate premium execution, or make procurement recommendations.
