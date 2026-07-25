# Policy Configuration

Hosted inference remains denied by default.

Capability-specific hosted policy is enabled only for:

- `legacy.ai.structured_response`
- `supervisor.daily_operations_report`

Supervisor capability controls:

- approved provider: `openai`
- approved model class: `HOSTED_BALANCED`
- premium models: disabled
- local inference: disabled
- provider retention: existing `store: false`
- cost: unknown unless existing OpenAI rate env vars are configured
- authorized roles: Supervisor, Organization Admin, Platform Admin
- non-supervisor roles with generic `intelligence.view` are denied by `SUPERVISOR_CAPABILITY_ROLE_DENIED`
- output is advisory only and requires human interpretation

No new permission was created.