# Narrow Candidate Expansion Plan

This MS-004-only plan adds candidates only for the three unresolved D2 capabilities. It does not reopen the six locked selections, does not select a winner, and does not activate production routing.

New model-capability pairs: `6`
Expected additional hosted calls: `48`
Estimated additional cost: `$0.281104`
Remaining budget after expected run: `$8.381288`

## Candidates

| Capability | Candidate | Provider | Model | Classification | Per Call USD | Expected 8-Call USD | Reason | Cheaper Existing Insufficient |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| driver.copilot.contextual_response | driver.copilot.contextual_response::gpt-5.6-luna | OpenAI | gpt-5.6-luna | LOWER-COST_STRONGER_CANDIDATE_NEEDED | 0.0012 | 0.0096 | Cheapest new current OpenAI candidate with structured-output support; tests whether the newer GPT-5.6 low-cost tier follows the driver response contract better than the failed GPT-5 nano/mini/GPT-5 ladder. | GPT-5 nano, GPT-5 mini, GPT-5, and Claude Haiku 4.5 each missed required driver output fields in all 8 corrected-request repetitions. |
| driver.copilot.contextual_response | driver.copilot.contextual_response::gemini-3.7-flash | Google | gemini-3.7-flash | PROVIDER-DIVERSITY_CANDIDATE_NEEDED | 0.004125 | 0.033 | Adds one current Google candidate with documented structured-output support and stronger multi-step reliability for driver-facing contextual conversation. | No Google candidate was tested for driver copilot, and all lower-cost OpenAI/Anthropic corrected-request candidates failed the same hard gates. |
| route.risk_explanation.presentation | route.risk_explanation.presentation::gemini-3.7-flash | Google | gemini-3.7-flash | PROVIDER-DIVERSITY_CANDIDATE_NEEDED | 0.00375 | 0.03 | Adds a current Google structured-output candidate for route-risk explanation after OpenAI and Anthropic candidates failed to preserve required output fields. | GPT-5 nano, GPT-5, and Claude Haiku 4.5 all failed 8/8 corrected-request route hard gates. |
| route.risk_explanation.presentation | route.risk_explanation.presentation::mistral-medium-3-5 | Mistral | mistral-medium-3-5 | PREMIUM_CANDIDATE_JUSTIFIED | 0.0075 | 0.06 | Adds a stronger Mistral candidate because Mistral Small produced the cheapest sufficient selections for adjacent presentation capabilities but was not tested for route risk. | Mistral Small was not part of the route shortlist, while the tested cheaper OpenAI/Anthropic candidates all failed mandatory gates. |
| safety.narrative_summary.presentation | safety.narrative_summary.presentation::claude-sonnet-5 | Anthropic | claude-sonnet-5 | PREMIUM_CANDIDATE_JUSTIFIED | 0.0135 | 0.108 | Direct upgrade from the near-pass Claude Sonnet 4.6 result, which passed 4/8 corrected-request repetitions and is the closest existing evidence. | Claude Sonnet 4.6 partially passed but still missed required safety fields in 4/8 repetitions; OpenAI GPT-5 mini and GPT-5 failed all 8. |
| safety.narrative_summary.presentation | safety.narrative_summary.presentation::gemini-3.7-flash | Google | gemini-3.7-flash | PROVIDER-DIVERSITY_CANDIDATE_NEEDED | 0.005063 | 0.040504 | Adds one non-Anthropic current structured-output candidate for safety narrative comparison without selecting a winner from documentation alone. | OpenAI lower-cost candidates failed all corrected-request safety gates and no Google safety candidate has been tested. |

## Official Sources

| Provider | Model ID | Status | Input $/1M | Cached Input $/1M | Output $/1M | Verified | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OpenAI | gpt-5.6-luna | CURRENT_SUPPORTED | 0.2 | 0.02 | 1.2 | 2026-08-22 | https://developers.openai.com/api/docs/models/gpt-5.6-luna |
| Google | gemini-3.7-flash | CURRENT_SUPPORTED | 0.75 | 0.075 | 3.75 | 2026-08-22 | https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash |
| Anthropic | claude-sonnet-5 | CURRENT_SUPPORTED | 2 | NONE | 10 | 2026-08-22 | https://platform.claude.com/docs/en/about-claude/models/whats-new-sonnet-5 |
| Mistral | mistral-medium-3-5 | CURRENT_SUPPORTED | 1.5 | 0.15 | 7.5 | 2026-08-22 | https://docs.mistral.ai/models/mistral-medium-3-5-26-04 |

## External Commands

| Capability | PowerShell Command |
| --- | --- |
| driver.copilot.contextual_response | npm.cmd run ms004:resume -- --capability=driver.copilot.contextual_response --candidate=driver.copilot.contextual_response::gpt-5.6-luna |
| driver.copilot.contextual_response | npm.cmd run ms004:resume -- --capability=driver.copilot.contextual_response --candidate=driver.copilot.contextual_response::gemini-3.7-flash |
| route.risk_explanation.presentation | npm.cmd run ms004:resume -- --capability=route.risk_explanation.presentation --candidate=route.risk_explanation.presentation::gemini-3.7-flash |
| route.risk_explanation.presentation | npm.cmd run ms004:resume -- --capability=route.risk_explanation.presentation --candidate=route.risk_explanation.presentation::mistral-medium-3-5 |
| safety.narrative_summary.presentation | npm.cmd run ms004:resume -- --capability=safety.narrative_summary.presentation --candidate=safety.narrative_summary.presentation::claude-sonnet-5 |
| safety.narrative_summary.presentation | npm.cmd run ms004:resume -- --capability=safety.narrative_summary.presentation --candidate=safety.narrative_summary.presentation::gemini-3.7-flash |

Status remains `CANDIDATE_FOR_BENCHMARK` until external LIVE_HOSTED evidence passes MS-002 hard gates.
