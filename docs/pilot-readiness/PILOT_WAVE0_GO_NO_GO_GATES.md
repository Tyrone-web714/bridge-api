# Pilot Wave 0 Go/No-Go Gate Normalization

| Gate | Current status | P0 dependencies | Exit criteria | Evidence required | Closure approver |
| --- | --- | --- | --- | --- | --- |
| SECURITY_AND_TENANT | BLOCKED | PILOT-P0-009, PILOT-P0-004 | Tenant isolation passes across API, mobile, queue, media, and supervisor views. | Test logs, fixture IDs, supervisor screenshots/logs, no cross-tenant access evidence. | Engineering lead and security owner |
| FIELD_SAFETY | BLOCKED | PILOT-P0-002, PILOT-P0-007 | Representative route validates low bridge, no-truck, residential, hazard, deviation, and stale-route behavior. | Field checklist, observer notes, route/hazard fixture, app evidence. | Safety owner and engineering lead |
| MOBILE_OFFLINE_SYNC | BLOCKED | PILOT-P0-001, PILOT-P0-003 | Offline/reconnect/restart replay works without duplicate or cross-tenant mutation. | Device logs, queued operation IDs, final route/stop state, supervisor verification. | Mobile lead |
| DATA_ONBOARDING | BLOCKED | PILOT-P0-004, PILOT-P0-010 | Pilot Organization dataset is approved and dry-run imported. | Source files, import summary, tenant ownership verification, rollback notes. | Owner data contact and engineering lead |
| BACKEND_ENVIRONMENT | BLOCKED | PILOT-P0-005, PILOT-P0-006 | Pilot backend has approved database, CORS, storage, secrets, maps, admin, health, and readiness configuration. | `verify:production` equivalent evidence from pilot environment. | Infrastructure owner |
| BACKUP_RESTORE | BLOCKED | PILOT-P0-005 | Backup/PITR confirmed and isolated restore rehearsal passes. | Backup setting evidence, restore log, cleanup confirmation. | Infrastructure owner |
| OBSERVABILITY_SUPPORT | BLOCKED | PILOT-P0-006, PILOT-P0-008 | Alerts, walkthrough, support owner, rollback owner, and escalation path are approved. | Alert test, dashboard walkthrough, runbook signoff. | Operations owner |
| PILOT_RELEASE_ARTIFACT | BLOCKED | PILOT-P0-003 | Approved APK artifact installed on approved devices and targets the approved HTTPS backend. | Build ID, artifact hash/link, device install evidence, backend target. | Mobile lead and owner |
| ORGANIZATION_READINESS | BLOCKED | PILOT-P0-010, PILOT-P0-004 | Scope, dates, drivers, routes, devices, success metrics, and contacts are approved. | Signed pilot scope packet. | Owner |
| AI_SCOPE | READY WITH RESTRICTION | None | D1 OFF and D2 production routing disabled. | Config/repository evidence and owner decision. | Owner and engineering lead |

No gate can close on repository evidence alone when the gate requires owner approval,
environment configuration, physical field evidence, or support-process evidence.
