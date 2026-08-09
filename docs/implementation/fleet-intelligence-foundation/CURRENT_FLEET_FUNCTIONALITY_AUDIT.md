# Current Fleet Functionality Audit

| Component | Classification | Decision |
| --- | --- | --- |
| `db/postgres.js` `used_truck_profile` on route sessions | REUSE_UNCHANGED | Route Intelligence owns truck profile compatibility evidence; Fleet references the result. |
| `daily_route_manifests.assigned_driver_id` | REFERENCE_ONLY | Existing route/driver assignment evidence is driver-oriented; Fleet does not add vehicle assignment fields. |
| `route_truck_inventory_additions` and `route_truck_inventory_allocations` | REFERENCE_ONLY | These are truck inventory/load records, not vehicle readiness records. |
| Route Intelligence vehicle profile contract | REUSE_UNCHANGED | Route Intelligence remains authoritative for dimension, clearance, restriction, and route safety compatibility. |
| Driver Intelligence assigned vehicle references | REFERENCE_ONLY | Driver records may identify assigned vehicle references but are not scored or ranked. |
| Supervisor Intelligence route portfolio vehicle references | REUSE_UNCHANGED | Fleet emits supervisor-visible evidence without changing dashboard/runtime behavior. |
| Warehouse Intelligence assigned vehicle and departure evidence | REFERENCE_ONLY | Warehouse departure readiness can contribute evidence but Fleet does not change warehouse flows. |
| `services/fleetIntelligenceScoring.js` and migration `008` | REFERENCE_ONLY | Existing Fleet Intelligence Scoring is a business scoring subsystem and remains separate from operational readiness. |
| Fleet scoring routes/RBAC/dashboard card | OUT_OF_SCOPE | No public Fleet Intelligence operational API, route, RBAC permission, or dashboard change is added. |
| New vehicle table, telematics, ELD, OBD, CAN bus, IoT integrations | DEFER | No production field or hardware integration is invented. |
