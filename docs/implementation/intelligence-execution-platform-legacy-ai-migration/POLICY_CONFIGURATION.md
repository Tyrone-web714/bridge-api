# Policy Configuration

Hosted inference remains denied by default for the foundation.

AI-IEP-002 adds the minimum capability-specific policy exception for `legacy.ai.structured_response`:

- hosted inference: allowed only when trusted organization context exists
- provider: `openai`
- model class: `HOSTED_BALANCED`
- premium models: not allowed
- local inference: not used
- provider storage: preserved as disabled through existing `store: false`
- model improvement/training: no new provider-side retention behavior is introduced
- cost ceiling: no synthetic zero-dollar cost; pricing stays unknown unless configured through existing env vars
- role permissions: IEP requires `intelligence.view`; existing route/admin/driver access checks remain in place

Policy denial remains fail-closed when authentication, organization context, permission, capability, or strategy requirements are not satisfied.
