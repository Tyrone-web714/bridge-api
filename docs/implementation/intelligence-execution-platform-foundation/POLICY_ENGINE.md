# Policy Engine

The policy engine is conservative by default:

- tenant-scoped execution requires trusted Organization context;
- caller must have intelligence.view;
- disabled capabilities are rejected;
- hosted inference is denied by default;
- premium models are denied by default;
- safety/compliance/employment/financial critical requests require human review.

Persisted per-Organization policies are deferred. The resolver boundary is implemented for future policy storage.

## AI-IEP-002 Hosted Policy Exception

Hosted inference remains denied by default. AI-IEP-002 adds a capability-specific exception for `legacy.ai.structured_response` when trusted organization context and `intelligence.view` permission are present. Approved provider is `openai`, approved model class is `HOSTED_BALANCED`, premium models remain disabled, and pricing remains unknown unless existing OpenAI cost-rate environment variables are configured.
