# Error Translation Matrix

| Condition | Internal error | Legacy HTTP behavior | Retry safe | Audit/telemetry |
| --- | --- | --- | --- | --- |
| Request validation failure | existing route validation or `INVALID_INTELLIGENCE_REQUEST_FIELD` | existing 400 response | no | request rejected when IEP reached |
| Authentication failure | existing auth middleware | existing 401 response | after authentication | existing security audit |
| Authorization failure | `PERMISSION_DENIED` | 403 through IEP or existing route middleware | after permission change | policy evaluated and rejected |
| Missing organization context | `ORGANIZATION_CONTEXT_REQUIRED` | 403 | after context fix | policy rejected |
| Capability disabled/not found | `CAPABILITY_DISABLED` or `CAPABILITY_NOT_FOUND` | 403 through IEP | no | policy rejected |
| Hosted policy denial | `INTELLIGENCE_POLICY_DENIED` | 403 | no | policy rejected |
| Budget denial | `BUDGET_DENIED` | 403 | no | budget denied |
| Provider unavailable | existing `ai_provider_unavailable` | 503 | yes | execution failed |
| Timeout | existing `ai_timeout` or IEP timeout | 504 | yes | execution failed |
| Rate limit | existing `ai_rate_limited` | 429 | yes | execution failed |
| Quota unavailable | existing `ai_quota_exceeded` | 503 | no | execution failed |
| Malformed provider response | `ai_empty_response` or `ai_invalid_structured_output` | 502 | maybe | validation/execution failed |
| Structured output validation failure | `INTELLIGENCE_OUTPUT_INVALID` | 502 | maybe | validation failed |
| Internal execution failure | `INTELLIGENCE_EXECUTION_ERROR` | existing route fallback 500 unless status set | no | execution failed |

Raw provider details, credentials, and headers remain hidden from legacy responses.
