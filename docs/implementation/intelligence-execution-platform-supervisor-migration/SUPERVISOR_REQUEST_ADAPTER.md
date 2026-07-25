# Supervisor Request Adapter

Implementation: `bridge-api/services/intelligenceExecution/supervisorAiAdapter.js`.

The adapter builds an IntelligenceRequest for `supervisor.daily_operations_report` with:

- feature: `supervisor_intelligence.scheduled_daily_report`
- taskType: `SUMMARIZE`
- executionMode: `SYNCHRONOUS`
- data sensitivity: `ORGANIZATION_PRIVATE`
- safety classification: `HIGH`
- execution profile: `BALANCED`
- hosted inference: true
- local inference: false
- premium escalation: false
- output schema: scheduled report schema
- prompt metadata: prompt ID/version
- advisory/employment/safety metadata

Trusted context:

- Manual route execution passes `req.authContext` or `authorization.buildAuthContext(req)`.
- Background scheduled execution uses a server-derived supervisor/system context scoped to the bootstrap Organization when no request context exists.
- Client-provided organization, role, provider, model, model class, premium, policy, and cost settings are not accepted.