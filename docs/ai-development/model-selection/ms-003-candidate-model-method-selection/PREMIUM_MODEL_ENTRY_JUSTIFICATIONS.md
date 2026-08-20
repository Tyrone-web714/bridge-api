# Premium Model Entry Justifications

| Capability | Model | Justification |
| --- | --- | --- |
| driver.copilot.contextual_response | gpt-5 | Driver copilot responses are safety-adjacent and interactive; GPT-5 is included only to determine whether cheaper candidates fail required grounding/uncertainty gates. |
| route.risk_explanation.presentation | gpt-5 | Route-risk explanation is safety-adjacent; GPT-5 is included only as an upper-bound comparison to prove whether low-cost candidates are sufficient. |
| safety.narrative_summary.presentation | gpt-5 | Safety narrative presentation is safety-adjacent; GPT-5 is included only to test whether a premium upper bound materially improves hard-gate pass rate over cheaper candidates. |
