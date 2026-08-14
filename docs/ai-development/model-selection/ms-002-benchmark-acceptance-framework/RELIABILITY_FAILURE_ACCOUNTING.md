# Reliability And Failure Accounting

MS-002 requires future benchmark runs to account for failed and degraded behavior, not only successful responses.

- request failures counted
- timeouts counted
- malformed outputs counted
- schema failures counted
- retries counted
- non-deterministic instability measured where relevant
- refusal failures counted where response is required
- grounding failures counted
- unavailable service behavior recorded

Failure and retry overhead must be included in future cost calculations.
