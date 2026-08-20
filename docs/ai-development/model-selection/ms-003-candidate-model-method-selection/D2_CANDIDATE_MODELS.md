# D2 Candidate Models

D2 candidates are deliberately bounded to two to four hosted models per capability.

| Capability ID | Provider | Model | Input $/1M | Output $/1M | Reason |
| --- | --- | --- | --- | --- | --- |
| customer.account_guidance.presentation | Anthropic | claude-haiku-4-5 | 1 | 5 | Fast Claude candidate for customer/account advisory tone with structured output. |
| customer.account_guidance.presentation | OpenAI | gpt-5-nano | 0.05 | 0.4 | Lowest-cost customer guidance presentation candidate. |
| customer.account_guidance.presentation | Mistral | mistral-small-latest | 0.15 | 0.6 | Low-cost Mistral comparison candidate for customer-account summaries. |
| driver.copilot.contextual_response | Anthropic | claude-haiku-4-5 | 1 | 5 | Fast non-OpenAI comparison candidate with structured output support. |
| driver.copilot.contextual_response | OpenAI | gpt-5 | 1.25 | 10 | Upper-bound safety and grounding comparison for driver-facing response. |
| driver.copilot.contextual_response | OpenAI | gpt-5-mini | 0.25 | 2 | Cost-controlled escalation candidate for interactive copilot prompts requiring stronger instruction following than nano. |
| driver.copilot.contextual_response | OpenAI | gpt-5-nano | 0.05 | 0.4 | Cheapest current GPT-5-family candidate for high-volume contextual driver response. |
| operations.executive_dashboard_synthesis | Anthropic | claude-haiku-4-5 | 1 | 5 | Fast Claude candidate for cross-domain synthesis with structured output. |
| operations.executive_dashboard_synthesis | Google | gemini-3.5-flash | 1.5 | 9 | Long-context Gemini candidate for broader cross-domain context. |
| operations.executive_dashboard_synthesis | OpenAI | gpt-5-mini | 0.25 | 2 | Cost-controlled OpenAI synthesis candidate for cross-domain operational dashboard context. |
| platform.legacy_structured_ai_response | Google | gemini-3.5-flash-lite | 0.3 | 2.5 | Low-cost non-OpenAI structured-output comparison candidate for future adapter evaluation. |
| platform.legacy_structured_ai_response | OpenAI | gpt-5-mini | 0.25 | 2 | Cost-controlled OpenAI escalation candidate for legacy structured-response compatibility. |
| platform.legacy_structured_ai_response | OpenAI | gpt-5-nano | 0.05 | 0.4 | Cheapest OpenAI structured-response compatibility candidate. |
| route.risk_explanation.presentation | Anthropic | claude-haiku-4-5 | 1 | 5 | Fast Claude candidate for grounded safety-adjacent explanation with structured-output support. |
| route.risk_explanation.presentation | OpenAI | gpt-5 | 1.25 | 10 | Upper-bound safety-adjacent grounding comparison for route-risk explanation. |
| route.risk_explanation.presentation | OpenAI | gpt-5-nano | 0.05 | 0.4 | Lowest-cost structured explanation candidate for supplied route-risk facts. |
| safety.narrative_summary.presentation | Anthropic | claude-sonnet-4-6 | 3 | 15 | Higher-capability Claude candidate for safety-adjacent structured narrative grounding. |
| safety.narrative_summary.presentation | OpenAI | gpt-5 | 1.25 | 10 | Upper-bound comparison for safety authority trace summarization. |
| safety.narrative_summary.presentation | OpenAI | gpt-5-mini | 0.25 | 2 | Cost-controlled OpenAI candidate for safety narrative summarization. |
| supervisor.daily_operations_report.narrative | Google | gemini-3.5-flash-lite | 0.3 | 2.5 | Low-cost high-throughput hosted comparison candidate for batch narrative generation. |
| supervisor.daily_operations_report.narrative | OpenAI | gpt-5-nano | 0.05 | 0.4 | Lowest-cost structured narrative candidate for batch supervisor reporting. |
| supervisor.daily_operations_report.narrative | Mistral | mistral-small-latest | 0.15 | 0.6 | Low-cost Mistral candidate with structured-output capability and favorable token pricing. |
| supervisor.freeform_question_answer | Anthropic | claude-haiku-4-5 | 1 | 5 | Fast Claude comparison candidate for grounded operational QA. |
| supervisor.freeform_question_answer | Google | gemini-3.5-flash | 1.5 | 9 | Long-context Gemini candidate where supervisor questions may include broad operational context. |
| supervisor.freeform_question_answer | OpenAI | gpt-5-mini | 0.25 | 2 | Cost-controlled OpenAI candidate for operational QA with structured output. |
| warehouse.exception_summary.presentation | Google | gemini-3.5-flash-lite | 0.3 | 2.5 | Low-cost high-throughput comparison candidate for warehouse exception summaries. |
| warehouse.exception_summary.presentation | OpenAI | gpt-5-nano | 0.05 | 0.4 | Lowest-cost structured summary candidate for deterministic warehouse exceptions. |
| warehouse.exception_summary.presentation | Mistral | mistral-small-latest | 0.15 | 0.6 | Low-cost Mistral comparison candidate for concise structured summaries. |
