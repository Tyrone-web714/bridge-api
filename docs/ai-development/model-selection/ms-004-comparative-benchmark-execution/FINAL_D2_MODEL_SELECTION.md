# Final D2 Model Selection

Source live run: `ms004.live.2026-08-22T00-16-33-541Z`
Source live run hash: `d09c564644f039c41b5305f93d1f18e881f4e06111d61ee7e61f80c1cb5a779d`
Corrected-request marker: `supersededHardGateFailures`
Completed LIVE_HOSTED calls: `199`
Failed calls: `25`
Measured spend: `$1.3376082`
D2_MODEL_SELECTION_COMPLETE: `false`

## Final Matrix

| Capability | Provider | Model | Status | Hard Gate | Avg Latency Ms | Avg Cost USD | Quality | Reason | Higher Cost Exception | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| customer.account_guidance.presentation | mistral | mistral-small-latest | FINAL_MODEL_SELECTION_READY | PARTIAL_PASS_PRESERVED_PRIOR_SELECTION | 1808.125 | 0.000178 | 70 | Cheapest sufficient hard-gate-passing candidate under MS-002 policy; previously approved six selections are preserved unless evidence-integrity defects appear. | NONE | COMPLETE_FOR_SELECTION |
| driver.copilot.contextual_response | NONE | NONE | NO_CANDIDATE_PASSED | NO_PASSING_CANDIDATE | NONE | NONE | NONE | No corrected-request candidate passed all mandatory hard gates. | NONE | COMPLETE_NO_PASSING_CANDIDATE |
| operations.executive_dashboard_synthesis | google | gemini-3.5-flash | FINAL_MODEL_SELECTION_READY | PASS | 5243.75 | 0.002157 | 80 | Cheapest sufficient hard-gate-passing candidate under MS-002 policy; previously approved six selections are preserved unless evidence-integrity defects appear. | NONE | COMPLETE_FOR_SELECTION |
| platform.legacy_structured_ai_response | google | gemini-3.5-flash-lite | FINAL_MODEL_SELECTION_READY | PASS | 833.125 | 0.000448 | 80 | Cheapest sufficient hard-gate-passing candidate under MS-002 policy; previously approved six selections are preserved unless evidence-integrity defects appear. | NONE | COMPLETE_FOR_SELECTION |
| route.risk_explanation.presentation | NONE | NONE | NO_CANDIDATE_PASSED | NO_PASSING_CANDIDATE | NONE | NONE | NONE | No corrected-request candidate passed all mandatory hard gates. | NONE | COMPLETE_NO_PASSING_CANDIDATE |
| safety.narrative_summary.presentation | NONE | NONE | NO_CANDIDATE_PASSED | NO_PASSING_CANDIDATE | NONE | NONE | NONE | No corrected-request candidate passed all mandatory hard gates. | NONE | COMPLETE_NO_PASSING_CANDIDATE |
| supervisor.daily_operations_report.narrative | mistral | mistral-small-latest | FINAL_MODEL_SELECTION_READY | PARTIAL_PASS_PRESERVED_PRIOR_SELECTION | 1806.875 | 0.000185 | 50 | Cheapest sufficient hard-gate-passing candidate under MS-002 policy; previously approved six selections are preserved unless evidence-integrity defects appear. | NONE | COMPLETE_FOR_SELECTION |
| supervisor.freeform_question_answer | google | gemini-3.5-flash | FINAL_MODEL_SELECTION_READY | PASS | 14348.142857 | 0.001721 | 80 | Cheapest sufficient hard-gate-passing candidate under MS-002 policy; previously approved six selections are preserved unless evidence-integrity defects appear. | NONE | COMPLETE_FOR_SELECTION |
| warehouse.exception_summary.presentation | mistral | mistral-small-latest | FINAL_MODEL_SELECTION_READY | PARTIAL_PASS_PRESERVED_PRIOR_SELECTION | 1777.125 | 0.000175 | 60 | Cheapest sufficient hard-gate-passing candidate under MS-002 policy; previously approved six selections are preserved unless evidence-integrity defects appear. | NONE | COMPLETE_FOR_SELECTION |

## Candidate Evidence

| Capability | Candidate | Provider | Model | Completed | Failed | Gate Pass | Gate Fail | Eligibility | Avg Latency Ms | Avg Cost USD | Quality |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| customer.account_guidance.presentation | customer.account_guidance.presentation::claude-haiku-4-5 | anthropic | claude-haiku-4-5 | 0 | 8 | 0 | 0 | DISQUALIFIED | NONE | NONE | NONE |
| customer.account_guidance.presentation | customer.account_guidance.presentation::mistral-small-latest | mistral | mistral-small-latest | 8 | 0 | 7 | 1 | DISQUALIFIED | 1808.125 | 0.000178 | 70 |
| customer.account_guidance.presentation | customer.account_guidance.presentation::gpt-5-nano | openai | gpt-5-nano | 8 | 0 | 0 | 8 | DISQUALIFIED | 11431.375 | 0.000977 | 0 |
| driver.copilot.contextual_response | driver.copilot.contextual_response::claude-haiku-4-5 | anthropic | claude-haiku-4-5 | 8 | 0 | 0 | 8 | DISQUALIFIED | 2930.75 | 0.002027 | 0 |
| driver.copilot.contextual_response | driver.copilot.contextual_response::gpt-5 | openai | gpt-5 | 8 | 0 | 0 | 8 | DISQUALIFIED | 13927.5 | 0.015416 | 0 |
| driver.copilot.contextual_response | driver.copilot.contextual_response::gpt-5-mini | openai | gpt-5-mini | 8 | 0 | 0 | 8 | DISQUALIFIED | 12248.875 | 0.002274 | 0 |
| driver.copilot.contextual_response | driver.copilot.contextual_response::gpt-5-nano | openai | gpt-5-nano | 8 | 0 | 0 | 8 | DISQUALIFIED | 8049.375 | 0.000612 | 0 |
| operations.executive_dashboard_synthesis | operations.executive_dashboard_synthesis::claude-haiku-4-5 | anthropic | claude-haiku-4-5 | 0 | 8 | 0 | 0 | DISQUALIFIED | NONE | NONE | NONE |
| operations.executive_dashboard_synthesis | operations.executive_dashboard_synthesis::gemini-3.5-flash | google | gemini-3.5-flash | 8 | 0 | 8 | 0 | ELIGIBLE | 5243.75 | 0.002157 | 80 |
| operations.executive_dashboard_synthesis | operations.executive_dashboard_synthesis::gpt-5-mini | openai | gpt-5-mini | 8 | 0 | 0 | 8 | DISQUALIFIED | 18522.5 | 0.002929 | 0 |
| platform.legacy_structured_ai_response | platform.legacy_structured_ai_response::gemini-3.5-flash-lite | google | gemini-3.5-flash-lite | 8 | 0 | 8 | 0 | ELIGIBLE | 833.125 | 0.000448 | 80 |
| platform.legacy_structured_ai_response | platform.legacy_structured_ai_response::gpt-5-mini | openai | gpt-5-mini | 8 | 0 | 0 | 8 | DISQUALIFIED | 15920.125 | 0.002616 | 0 |
| platform.legacy_structured_ai_response | platform.legacy_structured_ai_response::gpt-5-nano | openai | gpt-5-nano | 8 | 0 | 0 | 8 | DISQUALIFIED | 9289.875 | 0.000751 | 0 |
| route.risk_explanation.presentation | route.risk_explanation.presentation::claude-haiku-4-5 | anthropic | claude-haiku-4-5 | 8 | 0 | 0 | 8 | DISQUALIFIED | 3395.25 | 0.002193 | 0 |
| route.risk_explanation.presentation | route.risk_explanation.presentation::gpt-5 | openai | gpt-5 | 8 | 0 | 0 | 8 | DISQUALIFIED | 14686 | 0.016909 | 0 |
| route.risk_explanation.presentation | route.risk_explanation.presentation::gpt-5-nano | openai | gpt-5-nano | 8 | 0 | 0 | 8 | DISQUALIFIED | 16599 | 0.000874 | 0 |
| safety.narrative_summary.presentation | safety.narrative_summary.presentation::claude-sonnet-4-6 | anthropic | claude-sonnet-4-6 | 8 | 0 | 4 | 4 | DISQUALIFIED | 8678.5 | 0.009278 | 40 |
| safety.narrative_summary.presentation | safety.narrative_summary.presentation::gpt-5 | openai | gpt-5 | 8 | 0 | 0 | 8 | DISQUALIFIED | 19456.75 | 0.01485 | 0 |
| safety.narrative_summary.presentation | safety.narrative_summary.presentation::gpt-5-mini | openai | gpt-5-mini | 8 | 0 | 0 | 8 | DISQUALIFIED | 19718.75 | 0.002882 | 0 |
| supervisor.daily_operations_report.narrative | supervisor.daily_operations_report.narrative::gemini-3.5-flash-lite | google | gemini-3.5-flash-lite | 8 | 0 | 8 | 0 | ELIGIBLE | 801.75 | 0.000481 | 80 |
| supervisor.daily_operations_report.narrative | supervisor.daily_operations_report.narrative::mistral-small-latest | mistral | mistral-small-latest | 8 | 0 | 5 | 3 | DISQUALIFIED | 1806.875 | 0.000185 | 50 |
| supervisor.daily_operations_report.narrative | supervisor.daily_operations_report.narrative::gpt-5-nano | openai | gpt-5-nano | 8 | 0 | 0 | 8 | DISQUALIFIED | 12399.375 | 0.001033 | 0 |
| supervisor.freeform_question_answer | supervisor.freeform_question_answer::claude-haiku-4-5 | anthropic | claude-haiku-4-5 | 0 | 8 | 0 | 0 | DISQUALIFIED | NONE | NONE | NONE |
| supervisor.freeform_question_answer | supervisor.freeform_question_answer::gemini-3.5-flash | google | gemini-3.5-flash | 7 | 1 | 7 | 0 | ELIGIBLE | 14348.142857 | 0.001721 | 80 |
| supervisor.freeform_question_answer | supervisor.freeform_question_answer::gpt-5-mini | openai | gpt-5-mini | 8 | 0 | 0 | 8 | DISQUALIFIED | 37451.5 | 0.002427 | 0 |
| warehouse.exception_summary.presentation | warehouse.exception_summary.presentation::gemini-3.5-flash-lite | google | gemini-3.5-flash-lite | 8 | 0 | 8 | 0 | ELIGIBLE | 748 | 0.000436 | 80 |
| warehouse.exception_summary.presentation | warehouse.exception_summary.presentation::mistral-small-latest | mistral | mistral-small-latest | 8 | 0 | 6 | 2 | DISQUALIFIED | 1777.125 | 0.000175 | 60 |
| warehouse.exception_summary.presentation | warehouse.exception_summary.presentation::gpt-5-nano | openai | gpt-5-nano | 8 | 0 | 0 | 8 | DISQUALIFIED | 9692.875 | 0.000796 | 0 |

## Provider Distribution

| Provider | Assigned Capabilities |
| --- | --- |
| anthropic | 0 |
| google | 3 |
| mistral | 3 |
| openai | 0 |

## Remaining Failure Reconciliation

| Category | Count |
| --- | --- |
| currentMaterialFailure | 3 |
| nonMaterialProviderFailure | 25 |
| supersededPreCorrectionEvidence | 133 |

D1 remains `D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA`. No production routing, provider activation, deployment, migration, secret change, or production orchestration is performed by MS-004.
