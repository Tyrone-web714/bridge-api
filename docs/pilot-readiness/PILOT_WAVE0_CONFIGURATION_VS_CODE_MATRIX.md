# Pilot Wave 0 Configuration Vs Code Matrix

This matrix separates defects from configuration, field, owner, and process work. No code
defect is proven by the Wave 0 audit.

| Issue | Code change? | Configuration? | External action? | Field test? | Owner decision? | Pilot blocker? |
| --- | --- | --- | --- | --- | --- | --- |
| Offline/reconnect/restart replay evidence | No defect proven | No | Device access | Yes | Test window | Yes |
| Field safety behavior evidence | No defect proven | Maps/data may be needed | Route/observer | Yes | Route risk controls | Yes |
| Current APK artifact evidence | No defect proven | Build env/API endpoint/maps key | Device/install | Parking-lot | Artifact approval | Yes |
| Pilot Organization data freeze | No | No | Organization export | No | Scope/data approval | Yes |
| Backup/PITR and restore rehearsal | No | Backup tier/PITR | Hosting/database owner | No | Backup tier | Yes |
| Alert delivery and dashboard walkthrough | No defect proven | Alert recipients/channels | Support owner | No | Support routing | Yes |
| Google Maps account/legal/quota | No | Maps keys/restrictions/quota | Account/legal owner | No | Compliance approval | Yes |
| Support and rollback procedure | No | No | Support owner | No | Escalation approval | Yes |
| Tenant isolation under offline/media replay | No defect proven | No | Pilot-equivalent dataset/devices | Yes | Evidence standard | Yes |
| Pilot scope authorization | No | No | Organization owner | No | Pilot launch scope | Yes |
| `validate:production-rollout` migration list drift | Yes, tiny validator maintenance later | No | No | No | No | No, but release-confidence blocker |
| Local `DATABASE_URL` placeholder | No | Yes in pilot env | Infrastructure owner | No | Pilot DB environment | Yes for pilot env |
| Local `CORS_ORIGIN` missing | No | Yes in pilot env | Frontend/domain owner | No | Pilot frontend/web origin | Yes for pilot env |
| `validate:pilot-integration` safe run | No | Isolated DB URL required | Local/staging DB owner | No | Approval to seed test data | Not until test gate |

## Environment Blocker Normalization

| Variable/finding | Classification | Meaning | Required for pilot |
| --- | --- | --- | --- |
| Placeholder-like `DATABASE_URL` | CONFIGURATION | Expected for local development when no pilot DB is selected. | Approved pilot database URL, SSL posture, backup/PITR tier, PostGIS, and named admin setup. |
| Missing `CORS_ORIGIN` | CONFIGURATION | Expected locally when no production web origin is selected. | Explicit HTTPS pilot web/admin origins; no wildcard production CORS. |
| Missing explicit production origin | EXTERNAL_DEPENDENCY | Requires owner/frontend/domain decision. | Approved web/admin origin and mobile API endpoint alignment. |

No production credentials or environment values are created by Wave 0.
