# Legacy Request Adapter

Implementation: `bridge-api/services/intelligenceExecution/legacyAiAdapter.js`.

The adapter accepts the same internal route call shape previously sent to `aiProvider.createStructuredResponse`:

- `endpoint`
- `instructions`
- `input`
- `schemaName`
- `schema`

It builds a normalized IntelligenceRequest with:

- capability: `legacy.ai.structured_response`
- feature: `legacy.ai.<endpoint>`
- task type: `ANSWER`
- execution mode: `SYNCHRONOUS`
- execution profile: `BALANCED`
- input/data sensitivity: `ORGANIZATION_PRIVATE`
- safety classification: `MEDIUM`
- hosted inference: enabled for this capability only
- premium escalation: disabled
- local inference: disabled
- timeout: existing OpenAI timeout setting

Trusted identity:

- organizationId comes from `authContext.organizationId` during IEP normalization.
- userId comes from `authContext.actorId`.
- userRole comes from `authContext.approvedRole` or `authContext.role`.

Client-supplied provider, model, model class, premium, policy, and cost settings are not accepted by the legacy adapter envelope.
