# Pilot Readiness Decision

Decision: PILOT_NOT_READY_BOTH

The project is not ready for a live production pilot because engineering readiness and
external owner-dependent readiness both remain incomplete.

Engineering gaps:

- Physical mobile offline/reconnect/restart replay is not validated.
- Field safety behavior is not validated on representative routes.
- Backup restore and alert delivery evidence is incomplete.
- Pilot data onboarding has not been rehearsed with real Organization data.
- A current pilot mobile build artifact has not been verified.

Engineering progress:

- Disposable backend pilot integration passed in Wave 2 against a local PostgreSQL/PostGIS
  database.
- Migrations `001` through `012` applied successfully in the disposable environment.
- Tenant-scoped route/stop/service-level data flow passed for synthetic Organizations.

External gaps:

- Pilot Organization, devices, routes, dates, and support ownership are not frozen.
- Google Maps account, quota, restrictions, attribution, and legal/compliance posture are not confirmed.
- Hosted production configuration, backup/PITR, and support access require owner confirmation.

Recommended next action:

Proceed to a separately approved mobile APK/device and field-verification preparation
wave while continuing owner-dependent pilot environment, data, backup, maps, support, and
scope closure. Do not begin live pilot execution until every P0 gate in
PILOT_GO_NO_GO_GATES.md is complete and a new owner-approved pilot launch decision is recorded.
