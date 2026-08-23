# Pilot Wave 0 Scope Freeze

Baseline commit: ce6e4b46f94192c4558f59e3fb6d89154784d1df

Pilot decision remains: PILOT_NOT_READY_BOTH

Production routing status: NOT_ACTIVATED

Initial pilot scope is frozen as the smallest useful pilot that can prove Truck-Safe
Routing's core value proposition without introducing avoidable AI, data, identity, or
warehouse scope.

## Frozen Pilot Size

| Dimension | Scope |
| --- | --- |
| Organizations | 1 |
| Depots | 1 |
| Drivers | 2-3 |
| Routes per day | 3-5 |
| Backend | One explicitly approved pilot backend environment |
| Mobile | One approved standalone preview or production APK artifact |
| Pilot data | Approved route, stop, driver, supervisor, and support dataset only |

## Role Scope

| Role or workflow | Decision | Reason |
| --- | --- | --- |
| Driver | YES | Required to prove route display, safety warnings, stop completion, and offline sync. |
| Supervisor | YES | Required to prove authorized route/stop visibility and support evidence capture. |
| Warehouse | NO for first pilot | Include only if departure/return inventory is explicitly part of the owner-approved pilot. |
| Support operator | YES | Required for incident response and rollback execution. |
| Platform admin | INTERNAL ONLY | Required for setup/support, not routine pilot use. |

## Feature Scope

| Feature | Pilot posture |
| --- | --- |
| Authentication and tenant-scoped access | PILOT_REQUIRED |
| Driver route assignment | PILOT_REQUIRED |
| Truck-safe route display | PILOT_REQUIRED |
| Low-clearance warnings | PILOT_REQUIRED |
| No-truck/residential avoidance | PILOT_REQUIRED |
| Speed warnings | PILOT_REQUIRED where supported by current mobile route behavior |
| Stop completion | PILOT_REQUIRED |
| Offline stop completion | PILOT_REQUIRED after field verification passes |
| Route cache | PILOT_REQUIRED |
| Supervisor route/stop visibility | PILOT_REQUIRED |
| Driver notes | PILOT_OPTIONAL |
| Photos | PILOT_OPTIONAL after media replay and retention approval |
| Warehouse workflows | PILOT_OPTIONAL, default excluded |
| BI/KPI | SHADOW_ONLY |
| Heatmaps | POST_PILOT |
| WhatsApp | POST_PILOT |
| Advanced customer analytics | POST_PILOT |
| Executive dashboards | POST_PILOT |
| D2 AI | SHADOW_ONLY at most; production routing disabled |
| D1 predictions | DISABLED |
| SSO | OPTIONAL unless required by the pilot Organization |

## Core Pilot Value Proposition

The first pilot is intended to prove these measurable claims:

- TSR can assign and display a truck-safe route for one Organization.
- A driver can navigate a route on standalone mobile.
- TSR preserves Organization isolation across API, mobile, media, and queued operations.
- A driver can complete stops online and after offline/reconnect replay.
- Offline route actions synchronize without duplicate or cross-tenant mutation.
- Safety warnings occur at appropriate route points for representative hazards and restrictions.
- A supervisor can observe authorized route and stop status.
- No unsafe route-authority decisions are delegated to AI.

The first pilot is not intended to prove the entire platform, D1 analytics, production AI
orchestration, broad enterprise SSO, or full warehouse operations.
