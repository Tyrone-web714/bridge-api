# Pilot Wave 0 Owner Decisions

These decisions cannot be made by engineering alone.

| Decision ID | Decision | Options | Recommended Wave 0 answer | Needed before |
| --- | --- | --- | --- | --- |
| ODR-PILOT-001 | Pilot Organization | Named Organization or no pilot | Name one Organization | Any live pilot planning |
| ODR-PILOT-002 | Pilot scope | 1 depot/2-3 drivers/3-5 routes per day or other | Keep smallest frozen scope | Wave 1 |
| ODR-PILOT-003 | Pilot backend environment | Existing hosted backend, new staging, new pilot env | Explicit pilot env with no bundled production changes | Configuration |
| ODR-PILOT-004 | Pilot database environment | Local, staging, production-pilot DB | Isolated pilot/staging DB for rehearsal; production pilot only after gates | Integration test |
| ODR-PILOT-005 | Frontend/admin origin | Named HTTPS origin(s) | Explicit CORS origin list | Backend production verification |
| ODR-PILOT-006 | Mobile API endpoint | Render URL or alternate pilot backend | One HTTPS endpoint embedded in pilot APK | Mobile build |
| ODR-PILOT-007 | Backup tier | None, daily backup, PITR | PITR/provider-managed backup for live pilot | Go/no-go |
| ODR-PILOT-008 | Object storage | Existing private R2/S3-equivalent or alternate | Use private durable storage already hardened | Media/photos |
| ODR-PILOT-009 | Maps posture | Approved or not approved | Approve account/quota/legal/key restrictions before pilot | Route/map test |
| ODR-PILOT-010 | Secret storage | Hosted env, EAS env, vault | Managed hosted/EAS secret storage only | Build/config |
| ODR-PILOT-011 | Photos | Include, exclude, or notes only | Optional; include only after media replay evidence | Wave 1 |
| ODR-PILOT-012 | Driver notes | Include or exclude | Include if support needs route evidence | Wave 1 |
| ODR-PILOT-013 | Warehouse | Include or exclude | Exclude unless departure/return inventory is in pilot scope | Wave 1 |
| ODR-PILOT-014 | SSO | Required, optional, out of scope | Optional unless Organization requires it | Identity setup |
| ODR-PILOT-015 | D2 AI | Off, shadow, limited, enabled | SHADOW_ONLY at most | Any AI evidence |
| ODR-PILOT-016 | D1 | Off or enabled | OFF | Pilot launch |
| ODR-PILOT-017 | Field-test risk controls | Route, observer, stop conditions | Require second observer for road safety evidence | Field test |

Wave 0 is complete only when these owner decisions are recorded or explicitly deferred with
their pilot impact documented.
