# Capability Routing

| Capability | Provider | Model |
| --- | --- | --- |
| `customer.account_guidance.presentation` | Mistral | `mistral-small-latest` |
| `driver.copilot.contextual_response` | Google | `gemini-3.7-flash` |
| `operations.executive_dashboard_synthesis` | Google | `gemini-3.5-flash` |
| `platform.legacy_structured_ai_response` | Google | `gemini-3.5-flash-lite` |
| `route.risk_explanation.presentation` | Mistral | `mistral-medium-3-5` |
| `safety.narrative_summary.presentation` | Google | `gemini-3.7-flash` |
| `supervisor.daily_operations_report.narrative` | Mistral | `mistral-small-latest` |
| `supervisor.freeform_question_answer` | Google | `gemini-3.5-flash` |
| `warehouse.exception_summary.presentation` | Mistral | `mistral-small-latest` |

Runtime routing is deterministic. There is no dynamic model ranking, provider substitution, or unapproved OpenAI/Anthropic fallback.
