# AI Model Selection Gate

The Model Selection Gate remains `DEFERRED`, incomplete, inactive, and owner-approval gated.

## Current State

- Current analysis package: `MS-003`
- MS-001 is `PUSHED` and closed.
- MS-002 is `PUSHED` and closed.
- MS-003 is `IMPLEMENTED_UNCOMMITTED` and is the current candidate model/method selection package.
- Provider selection is not complete.
- Model selection is not complete.
- Hosted benchmarking has not been executed.
- Production orchestration is deferred and inactive.

## Cost Principle

Use the least expensive strategy or model that satisfies quality, safety, reliability, latency, governance, and evidence requirements. Cost never overrides truck safety, legal compliance, privacy, tenant isolation, policy controls, reliability, or minimum quality thresholds.

## Required Core Domains

- Route Intelligence
- Driver Intelligence
- Supervisor Intelligence
- Warehouse Intelligence
- Fleet Intelligence
- Customer Intelligence
- Operations Intelligence
- Safety Intelligence

## Permitted Model Selection Strategy Classes

- Deterministic/no-model execution where D0 satisfies the capability.
- Lightweight statistical or specialized methods for D1 where sufficient.
- Low-cost hosted models for D2 before higher tiers.
- Balanced hosted models only when lower-cost candidates plausibly fail.
- Premium hosted models only when capability-specific safety, grounding, complexity, or upper-bound evidence justifies benchmark inclusion.

## MS-003 Boundary

MS-003 may name benchmark candidates, record current official pricing, document source evidence, and forecast benchmark cost. MS-003 may not select a final provider, select a final model, rank winners, execute hosted benchmarks, activate hosted AI, deploy, run migrations, change production systems, or create a ninth intelligence domain.

## Next Gate

MS-004 benchmark execution may begin only under a separately approved package with explicit authorization for any hosted model/API calls and benchmark spending.
