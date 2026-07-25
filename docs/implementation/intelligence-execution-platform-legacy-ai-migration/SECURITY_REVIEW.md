# Security Review

Security properties preserved or strengthened:

- Legacy `/api/ai` route no longer imports `services/aiProvider.js` directly.
- Provider execution is isolated behind `services/intelligenceExecution/providerAdapters.js`.
- Tenant identity comes from `req.authContext` and IEP normalization.
- Client bodies cannot choose provider, model, model class, premium execution, policy version, or cost policy.
- Hosted inference is permitted only for `legacy.ai.structured_response`.
- Premium model escalation remains disabled.
- Provider storage remains disabled through `store: false`.
- Full prompts and provider credentials are not logged by IEP audit metadata.
- Missing organization context fails closed.

Residual security note:

- `services/supervisorIntelligence.js` still calls `aiProvider` directly. This is outside the active `/api/ai` migration and should be migrated in a later approved work package if it remains an active production execution path.
