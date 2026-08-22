# Pilot Blocker Inventory

Summary counts:

- P0 pilot blockers: 10
- P1 pre-pilot hardening items: 8
- P2/P3 follow-up items: 8
- External owner-dependent blockers: 5

P0 blockers:

| Gap ID | Domain | Blocking condition | Exit criteria |
| --- | --- | --- | --- |
| PILOT-P0-001 | Mobile | Physical offline/reconnect/restart replay is not verified. | Successful physical-device replay with no tenant leak, no duplicate stop mutation, and retained audit evidence. |
| PILOT-P0-002 | Safety | Field safety warnings and route-deviation behavior are not road validated. | Representative route validation covering low bridge, truck restriction, hazard, stale-route, and override/refusal behavior. |
| PILOT-P0-003 | Build | Current pilot APK/build artifact is not verified. | Signed preview or production APK identified, install tested, and confirmed to target the approved HTTPS backend. |
| PILOT-P0-004 | Data | Real pilot Organization onboarding data is not frozen. | Approved Organization, depots, users, drivers, devices, routes, stops, and support contacts are provided and dry-run imported. |
| PILOT-P0-005 | Backup | Backup and restore evidence is not current. | Provider backup/PITR confirmed and restore rehearsal completed in isolated non-production environment. |
| PILOT-P0-006 | Observability | Alert delivery and operational dashboard walkthrough are not verified. | Health/readiness, error, auth, media, sync, and route-operation alerts have named recipients and test evidence. |
| PILOT-P0-007 | Google Maps | Account, quota, key restrictions, attribution, and legal review are unresolved. | Owner confirms account readiness, quota, restrictions, terms review, and attribution/compliance coverage. |
| PILOT-P0-008 | Support | Pilot support and rollback runbook is incomplete. | Support owner, escalation path, rollback decision tree, evidence capture, and communications plan are approved. |
| PILOT-P0-009 | Security/Tenant | End-to-end tenant isolation under mobile offline/background replay is not proven. | Tenant-scoped API, mobile, queue, media, and background operations pass staged pilot rehearsal. |
| PILOT-P0-010 | External scope | Pilot Organization authorization and field schedule are missing. | Owner-approved pilot scope, driver list, device list, route dates, and success criteria are frozen. |

P1 readiness items:

- SSO decision and enterprise identity integration, if required by the pilot Organization.
- Multi-driver route concurrency and conflict handling rehearsal.
- Route and stop import dry run with pilot-format source files.
- Media/photo retention and offline media handling policy.
- Long-route, battery, GPS-loss, and permission-denial mobile tests.
- Warehouse MFA and warehouse user inclusion decision.
- D2 shadow-only evidence package, if AI outputs are observed during pilot operations.
- Pilot performance rehearsal for route assignment, stop sync, media, and supervisor views.

P2/P3 follow-up items:

- D1 representative historical analytics and predictive/statistical method selection.
- Production AI orchestration and provider routing activation.
- Full enterprise SSO rollout.
- App store distribution and broader device management.
- Extended load testing beyond pilot volumes.
- Automated support dashboards and incident reporting.
- Seasonal hazard source freshness automation.
- Long-term retention, deletion, and data-subject request rehearsals.
