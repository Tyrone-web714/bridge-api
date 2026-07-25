# FIXED COST ALLOCATION

AI-IEP-004A.5 implements repository-native, provider-neutral, test-only cost governance downstream from evaluation and scoring.

It uses synthetic pricing catalogs, cost model profiles, budget profiles, and cost-governance requests under bridge-api/cost-governance.

The subsystem uses integer micro-USD accounting, preserves UNKNOWN separately from known zero, labels MOCK, MODELED, ESTIMATED, DERIVED, and UNKNOWN sources, and keeps budget blocking simulation-only.

It does not call providers, read production data, expose public APIs, write databases, enforce production budgets, activate premium execution, rank providers, declare best value, make procurement recommendations, or claim ROI/TCO.

Owner decisions remain required for real provider prices, real infrastructure and human-review assumptions, production budgets, production thresholds, premium rules, final cost-effectiveness formulas, TCO scope, ROI scope, and procurement policy.
