# AI Model Selection Gate

The Model Selection Gate remains `DEFERRED`, incomplete, inactive, and owner-approval gated.

## Current State

- Current analysis package: `MS-004`
- MS-001 is `PUSHED` and closed.
- MS-002 is `PUSHED` and closed.
- MS-003 is `PUSHED` and closed.
- MS-004 status: `BLOCKED`
- Dry-run result: `READY_FOR_EXECUTION`
- Live hosted benchmark calls executed: `48`
- Provider selection is not complete.
- Model selection is not complete.
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

## MS-004 Boundary

MS-004 may collect benchmark evidence and propose candidate winners when execution evidence exists. MS-004 may not activate providers/models in production, deploy, run migrations, change production systems, or mark the Model Selection Gate complete before owner approval.

## Permitted Model Selection Strategy Classes

- Deterministic/no-model execution where D0 satisfies the capability.
- Lightweight statistical or specialized methods for D1 where sufficient.
- Low-cost hosted models for D2 before higher tiers.
- Balanced hosted models only when lower-cost candidates plausibly fail.
- Premium hosted models only when capability-specific safety, grounding, complexity, or upper-bound evidence justifies benchmark inclusion.

## Current Blockers

- 0 capabilities lack frozen dataset evidence.
- 4 D1 capabilities require representative historical data before final method selection.
- 0 providers lack repository-local benchmark credentials.
- 0 provider adapters are unavailable or unconfigured for live benchmark execution.
