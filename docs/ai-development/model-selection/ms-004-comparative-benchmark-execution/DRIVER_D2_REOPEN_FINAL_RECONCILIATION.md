# Driver D2 Reopen Final Reconciliation

Status: `CLOSED`

Capability: `driver.copilot.contextual_response`

Final non-production selected model: `mistral / mistral-small-2603`

Selection status: `FINAL_MODEL_SELECTION_READY`

Production routing status: `NOT_ACTIVATED`

## Reason For Reopen

The original MS-004 Driver selection used `google / gemini-3.7-flash`. Later non-production runtime execution showed repeated authority-boundary failures, including failure after the one allowed corrective retry. That evidence made the Driver-specific runtime reliability of Gemini 3.7 insufficient for the selected-D2 runtime contract.

Gemini 3.7 Driver history is preserved and classified as `SUPERSEDED_RUNTIME_UNRELIABLE`. It must not be used as an automatic Driver fallback.

## Dataset V1 History

Authoritative cleaned evidence file: `driver-mistral-runtime-evidence.clean.json`

Dataset: `driver.copilot.contextual_response.runtime_reliability_reopen.v1`

Candidate: `mistral / mistral-small-2603`

Result:

| Metric | Value |
| --- | --- |
| Provider successes | 24 |
| Provider failures | 0 |
| Runtime passes | 20 |
| Runtime failures | 4 |
| Classification | DRIVER_RUNTIME_RELIABILITY_FAIL |

Failed v1 subrules:

| Subrule |
| --- |
| DRIVER_SAFETY_CLEARANCE |
| DRIVER_WORKFORCE_ACTION |

Dataset v1 exposed an architectural responsibility error: obvious authority requests were being sent to the generative Driver layer. The history is preserved and not rewritten.

## Deterministic Authority Layer

The following request classes are now deterministic pre-model policy responsibilities:

| Policy class |
| --- |
| DRIVER_SAFETY_CLEARANCE_REQUEST |
| DRIVER_WORKFORCE_DECISION_REQUEST |
| DRIVER_WORKFORCE_SCORING_REQUEST |
| DRIVER_ROUTE_AUTHORIZATION_REQUEST |
| DRIVER_RESTRICTION_OVERRIDE_REQUEST |

Intercepted requests return `responseMode=DETERMINISTIC_POLICY`, `policyIntercepted=true`, `providerCallSuppressed=true`, and `providerCostUsd=0`. Runtime hard gates remain active as defense in depth.

## Dataset V2 Final Evidence

Authoritative final evidence file: `driver-mistral-runtime-evidence-v2.json`

Dataset: `driver.copilot.contextual_response.runtime_reliability_reopen.v2`

Candidate: `mistral / mistral-small-2603`

Dataset v2 separates deterministic authority-policy tests from legitimate generative Driver model reliability tests. Difficult cases were not deleted; authority requests moved to the correct deterministic layer and remain mandatory system tests.

Result:

| Metric | Value |
| --- | --- |
| Generative scenarios | 10 |
| Repetitions per scenario | 2 |
| Hosted records | 20 |
| Provider successes | 20 |
| Provider failures | 0 |
| Runtime passes | 20 |
| Runtime failures | 0 |
| Corrective retries used | 0 |
| Runtime reliability status | DRIVER_RUNTIME_RELIABILITY_PASS |

## Other Candidate Status

| Candidate | Status | Consequence |
| --- | --- | --- |
| google / gemini-3.7-flash | SUPERSEDED_RUNTIME_UNRELIABLE | Preserved as historical MS-004 evidence; not a Driver fallback. |
| google / gemini-2.5-flash | NON_COMPARABLE_PROVIDER_FAILURE | No additional Gemini 2.5 calls required. |
| openai / gpt-5.6-terra | NOT_MATERIALLY_REQUIRED_AFTER_MISTRAL_V2_PASS | Not added or benchmarked. |

## Final Matrix Consequence

The final D2 provider distribution is:

| Provider | Capabilities |
| --- | --- |
| Mistral | 5 |
| Google | 4 |
| OpenAI | 0 |
| Anthropic | 0 |

`D2_MODEL_SELECTION_COMPLETE=true`

`ALL_NINE_D2_CAPABILITIES_FINAL_MODEL_SELECTION_READY=true`

D1 remains `D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA`.

No production routing, provider activation, hosted retry, deployment, migration, secret change, production orchestration, or D1 selection was performed by this reconciliation.

## Owner-Executed Smoke-Clean Evidence

Final smoke execution was owner-executed outside Codex. Codex did not execute hosted smoke calls.

Driver-only smoke result:

| Field | Value |
| --- | --- |
| Capability | driver.copilot.contextual_response |
| Provider / model | mistral / mistral-small-2603 |
| Status | SUCCEEDED |
| Hard gate result | PASS |
| Fallback used | false |
| Attempt count | 1 |
| Corrective retry used | false |

Full selected-D2 smoke result:

| Capability group | Result |
| --- | --- |
| All nine selected D2 capabilities | SUCCEEDED / PASS |
| Driver | Mistral Small 2603 first-pass success |
| Safety | Gemini 3.7 first attempt rejected by `prohibited_authority_or_workforce_action`, one corrective retry, final SUCCEEDED / PASS |
| All other capabilities | first-pass SUCCEEDED / PASS |

The final smoke evidence confirms the selected-D2 non-production baseline is smoke-clean, the bounded corrective retry mechanism works as designed, no model substitution occurred, production routing remained false, and no credentials were logged.
