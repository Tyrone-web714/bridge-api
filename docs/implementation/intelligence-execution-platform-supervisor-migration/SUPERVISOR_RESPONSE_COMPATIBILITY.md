# Supervisor Response Compatibility

Previous compatibility response from `createAiNarrative`:

- success: `{ content: result.parsed, generatedBy: openai:<model> }`
- provider unavailable/failure: deterministic fallback content, `generatedBy: rules_engine_ai_fallback`, and `errorMessage`

Post-migration compatibility response:

- success: `{ content, generatedBy, usage, estimatedCostUsd, actualCostUsd, traceId, requestId, promptVersion, advisoryOnly, humanReviewRequired }`
- report persistence still uses `content`, `generatedBy`, and `errorMessage`
- route response from `runSchedule` remains `{ ok: true, report, alerts }`
- fallback status remains `completed_with_ai_fallback`

Additive internal metadata is not exposed as provider credentials, raw provider payload, rejected strategy details, or tenant policy internals.