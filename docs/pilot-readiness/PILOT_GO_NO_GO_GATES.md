# Pilot Go/No-Go Gates

Pilot decision: NO-GO until every required go/no-go gate below is satisfied.

| Gate | Required outcome | Current status |
| --- | --- | --- |
| Repository baseline | Clean committed pilot-readiness baseline and no unauthorized production changes. | READY FOR AUDIT, not sufficient for pilot. |
| Mobile build | Current pilot APK installed on approved devices and pointed to the approved HTTPS backend. | BLOCKED. |
| Offline replay | Physical offline/reconnect/restart replay proves no duplicate or cross-tenant mutation. | BLOCKED. |
| Field safety | Representative field route validates low bridge, truck restriction, hazard, deviation, and stale-route behavior. | BLOCKED. |
| Tenant/security | API, media, mobile, queued operations, and supervisor views are tenant scoped under pilot rehearsal. | PARTIAL. |
| Data onboarding | Real Organization data imported or rehearsed with approved mappings and rollback plan. | BLOCKED. |
| Backup/restore | Backup, PITR, and isolated restore rehearsal are verified. | BLOCKED. |
| Observability | Alerts, dashboards, logs, and support evidence capture are verified with named recipients. | BLOCKED. |
| External compliance | Google Maps account/legal/quota/restrictions and pilot Organization authorization are complete. | BLOCKED. |
| AI scope | D1 and production D2 routing remain disabled unless separately approved. | READY WITH RESTRICTION. |

Go criteria:

- All P0 blockers are complete.
- No production AI route is active without separate authorization.
- No migration, deployment, provider, or infrastructure change is bundled into the pilot launch window.
- A named rollback owner can stop pilot operations and preserve evidence.

No-go criteria:

- Any P0 blocker remains open.
- Any mobile route action can execute without correct tenant or driver authority.
- Any safety warning path is untested for the representative pilot route.
- Any production credential, provider route, or storage setting is changed without the approved change window.
