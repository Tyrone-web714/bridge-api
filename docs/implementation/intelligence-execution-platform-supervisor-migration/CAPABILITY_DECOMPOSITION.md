# Capability Decomposition

Only one existing supervisor hosted function was found: scheduled daily supervisor brief narrative generation.

Capability: `supervisor.daily_operations_report`

- Version: `supervisor.daily_operations_report.v1`
- Business purpose: advisory narrative summary for existing scheduled supervisor daily brief.
- Input schema: `schemas/intelligence/supervisor-daily-operations-report-input.v1`.
- Output schema: `schemas/intelligence/supervisor-daily-operations-report-output.v1`.
- Safety classification: `HIGH` because output can discuss route, delivery, and driver-related operational exceptions.
- Employment-impact classification: `ADVISORY_ONLY_EMPLOYEE_RELATED`.
- Financial-impact classification: `ADVISORY_ONLY_OPERATIONAL`.
- Allowed execution strategies: `HOSTED_BALANCED_MODEL` only.
- Default profile: `BALANCED`.
- Latency target: 30000 ms.
- Hosted model permission: capability-specific only.
- Model class: `HOSTED_BALANCED`.
- Premium escalation: prohibited.
- Cache eligibility: false.
- Batch eligibility: false.
- Human review: supervisor interpretation required for any material action.
- Prompt identifier: `supervisor.daily_operations_report.prompt`.
- Prompt version: `supervisor-daily-operations-report.v1`.
- Status: active.

No broader supervisor copilot, unrestricted chat, employee scoring, or disciplinary capability was registered.