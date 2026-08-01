<!-- Generated from bridge-api/execution-decisions. Do not hand-edit. -->
# Execution Decision Summary

Execution Decision Engine outputs are synthetic, offline, advisory, and test-only. They do not perform production runtime selection, provider procurement, live provider calls, real budget enforcement, or premium activation.

| Request | Capability | Outcome | Candidates | Selected Strategy | Fallbacks |
| --- | --- | --- | --- | --- | --- |
| decision.structured_response.fail_closed.offline.v1 | legacy.ai.structured_response | DEFER_PENDING_EVIDENCE | 20 | none | 0 |
| decision.structured_response.initial.offline.v1 | legacy.ai.structured_response | SELECT_ADVISORY_CANDIDATE_WITH_FALLBACK | 20 | HOSTED_BALANCED | 3 |
| decision.supervisor_report.initial.offline.v1 | supervisor.daily_operations_report | HUMAN_REVIEW_REQUIRED | 20 | none | 0 |
| decision.text_cleanup.initial.offline.v1 | text.cleanup | SELECT_ADVISORY_CANDIDATE_WITH_FALLBACK | 20 | DETERMINISTIC_RULES | 3 |
