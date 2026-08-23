# Pilot Wave 0 External Dependencies

External blocker count remains: 5

## Normalized External Blockers

| Dependency | Owner | Required | Required by | Can engineering proceed? | Pilot can proceed? | Lead time | Fallback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Pilot Organization | Business owner | Organization, depot, routes, dates, users, drivers, devices, success metrics | Wave 0 | Only docs/test harness prep | No | Medium | Use synthetic rehearsal only; no live pilot. |
| Pilot users/drivers/devices | Operations owner | Driver list, supervisor list, device list, support contacts | Wave 0/Wave 1 | Limited static checks | No | Medium | Reduce to lab-only validation. |
| Organization data | Organization/data owner | Route, stop, customer/order, driver-device mapping in approved format | Wave 1 | Import tooling review | No | Medium | Use demo data only for non-production rehearsal. |
| Google Maps/legal/quota | Account/legal owner | Billing/quota, key restrictions, attribution, terms review, data-use posture | Wave 0 | Static compliance checks | No | Medium | No live pilot; route/map use cannot be claimed compliant. |
| Hosting/database/backup tier | Infrastructure owner | Pilot backend, pilot DB, backup/PITR, object storage, secret storage | Wave 0 | Repository validation | No | Medium | Local-only rehearsal; no live pilot. |

## Optional External Dependencies

| Dependency | Pilot posture |
| --- | --- |
| SSO credentials | OPTIONAL unless the pilot Organization requires enterprise login. |
| Mobile device management | OPTIONAL for controlled APK distribution; required for broader rollout. |
| Warehouse users | OPTIONAL; default excluded from first pilot. |
| D1 historical data | POST_PILOT. |
| D2 production provider activation | DISABLED unless separately approved. |

Engineering can proceed with Wave 1 readiness planning, validator maintenance, and test-harness
isolation design without these dependencies, but the live pilot cannot proceed without the
five normalized blockers above.
