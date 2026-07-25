# Current Registry Audit

The pre-existing registry was a hand-maintained JavaScript object in `services/intelligenceExecution/capabilityRegistry.js` with six IDs: `text.cleanup`, `legacy.ai.structured_response`, `supervisor.daily_operations_report`, `delivery_note.summarize`, `policy.answer`, and `route.risk_explanation`.

Active capabilities were `text.cleanup`, `legacy.ai.structured_response`, and `supervisor.daily_operations_report`. Disabled placeholders were `delivery_note.summarize`, `policy.answer`, and `route.risk_explanation`.

Gaps found: lifecycle, dependency, benchmark, cost-governance, provider-independence, approval, and authoritative-boundary metadata were either absent or duplicated across code and docs. Policy and planner still contain capability-specific behavior for hosted execution and supervisor role gates; this package records those as compatibility constraints rather than changing behavior.
