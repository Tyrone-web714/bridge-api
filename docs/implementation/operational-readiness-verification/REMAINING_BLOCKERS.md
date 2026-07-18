# Remaining Blockers

| Blocker | Status | Required Access Or Approval |
| --- | --- | --- |
| Production DB state | OWNER APPROVAL REQUIRED | Explicit approval to run read-only preflight against confirmed production `DATABASE_URL`; Render/provider access to confirm target. |
| Production backup | BLOCKED | Render access to identify the database provider, plus database provider dashboard/API/CLI access or owner-provided provider evidence. |
| Restore capability | NOT VERIFIED | Verified production backup, non-production restore target, and provider restore access. |
| Render environment variable review | BLOCKED | Render dashboard/API access. |
| Object storage write/read smoke | OWNER APPROVAL REQUIRED | Approval for disposable production test object and tenant-scoped test metadata. |
| Mobile offline/reconnect replay | OPERATIONAL VERIFICATION REQUIRED | Physical Android device with current pilot APK and assigned test route. |
| Authenticated dashboard walkthrough | OPERATIONAL VERIFICATION REQUIRED | Approved non-production/test accounts for supervisor, Organization Admin, Platform Admin, and warehouse. |
| Deployed commit/schema alignment | NOT VERIFIED | Render deploy metadata and approved read-only production DB inspection. |
| Provider verification | PAUSED | Future approved branch and actual Microsoft/Okta/Google/OIDC/SAML test providers. |
