# Execution Planner

The planner is deterministic and cost-first. It considers strategy order from cache through human review, records selected and rejected strategies, and returns an immutable plan.

For AI-IEP-001, 	ext.cleanup selects DETERMINISTIC_RULES. Cache is considered first but rejected because no approved exact cache implementation is active.

The planner does not use AI and does not allow callers to choose providers or model names.
