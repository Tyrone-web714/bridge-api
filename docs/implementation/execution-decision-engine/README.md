# Execution Decision Engine

AI-IEP-004A.6 adds a provider-neutral Execution Decision Engine downstream of the Capability Registry, Evaluation Engine, Scoring Engine, and Cost Governance layer. It enumerates candidate execution strategies, applies explicit Decision Policy Profiles, checks mandatory gates before utility, constructs advisory fallback plans, and emits deterministic decision records for test evidence.

The engine is intentionally separate from the runtime planner in bridge-api/services/intelligenceExecution/planner.js. Runtime execution behavior is unchanged.

## Boundary

AI-IEP-004A.6 is repository-only, synthetic, offline, advisory, and test-only. It does not deploy code, call live providers, write production data, mutate object storage, change cloud configuration, enforce production budgets, activate premium execution, or make procurement recommendations.

## Primary Artifacts

- bridge-api/services/intelligenceExecution/executionDecisionEngine.js
- bridge-api/execution-decisions/policy-profiles
- bridge-api/execution-decisions/requests
- bridge-api/scripts/generate-execution-decision-artifacts.cjs
- bridge-api/scripts/check-execution-decision-engine.cjs
