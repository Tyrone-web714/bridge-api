# Architecture

The Execution Decision Engine consumes registered capabilities, scoring records, and cost-governance records. It joins compatible score and cost evidence by capability, strategy, executor, dataset, and score identifier, then evaluates each candidate against request requirements and policy profile constraints.

Decision records contain candidate enumeration, feasibility, gate traces, threshold traces, cost traces, tie-break traces, fallback traces, counterfactuals, sensitivity analysis, hashes, and production-safety flags.

## Boundary

AI-IEP-004A.6 is repository-only, synthetic, offline, advisory, and test-only. It does not deploy code, call live providers, write production data, mutate object storage, change cloud configuration, enforce production budgets, activate premium execution, or make procurement recommendations.
