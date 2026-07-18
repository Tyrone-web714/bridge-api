# Integrated Workflow Map

## Driver

- Entry point: mobile login and driver route endpoints.
- Authentication: company driver number plus driver authentication/session context.
- Permissions: Driver role, Organization context, assigned-route ownership.
- Source data: driver registry, route manifest, route stops, delivery settlement, truck inventory, hazard reports.
- Writes: stop status, delivery settlement, notes, photos metadata, route events, inventory additions, closeout print confirmation.
- Downstream effects: route status, supervisor visibility, KPI source data, Logistics Intelligence events, FISS scoring inputs, Shared Safety nominations.
- Offline behavior: mobile AsyncStorage queues for route, stop, delivery, notes/photos metadata, route events, and assigned-route cache.
- Failure/retry: queued writes retry on reconnection; server-side idempotency is used where available.
- Incomplete: physical-device offline replay was not rerun in this phase.

## Warehouse

- Entry point: warehouse inventory confirmation and route inventory closeout endpoints.
- Authentication: employee ID plus second factor in the approved warehouse policy.
- Permissions: Warehouse Employee role, Organization context.
- Source data: route manifest, driver identity, loaded inventory, returned/damaged inventory.
- Writes: departure inventory print confirmation, return inventory closeout, print confirmation tokens, audit-relevant operational records.
- Downstream effects: route execution unlock, final inventory reconciliation, closeout availability.
- Incomplete: browser/mobile UI interaction was source-reviewed rather than physically retested.

## Supervisor

- Entry point: server-rendered admin/supervisor pages and protected API routes.
- Authentication: supervisor session/auth context.
- Permissions: Supervisor role plus explicit route, driver, hazard, KPI, intelligence, and report permissions.
- Source data: Organization-private drivers, routes, stops, notes, photos metadata, hazards, KPI snapshots, recommendations, scores.
- Writes: route assignment, operational review actions, recommendation decisions/outcomes where permitted.
- Incomplete: all dashboard pages were source-reviewed; only runtime service paths were executed.

## Organization Admin

- Entry point: protected administrative pages and APIs.
- Authentication: Organization Admin context.
- Permissions: Organization-scoped management, KPI configuration, operational administration.
- Source data: Organization-private users, drivers, routes, customers, KPIs, reports.
- Writes: driver/user management, KPI definitions and formula versions, Organization-private configuration.
- Constraint: cannot approve platform-global Shared Safety records.

## Platform Admin

- Entry point: platform admin context and Shared Safety moderation.
- Authentication: Platform Admin context.
- Permissions: platform-wide Shared Safety moderation and Organization support workflows.
- Source data: moderation candidates and sanitized shared safety records.
- Writes: sanitize, approve, reject, duplicate, merge, retire, supersede shared safety records.
- Constraint: no silent tenant switching; operational tenant data remains private.

## Shared Safety

Private Organization submissions can become moderation candidates. Platform Admin review sanitizes and approves only shared truck-safety knowledge. Published shared records omit private route, customer, driver, and Organization data.

## BI/KPI

Organization-scoped KPI definitions, immutable formula versions, snapshots, drill-down, and bounded export consume operational source data without crossing tenant boundaries.

## Logistics Intelligence

Organization-scoped operational events and KPI events generate signals, findings, advisory recommendations, decisions, and outcomes. It remains explainable and non-autonomous.

## FISS

Organization-private scoring models and immutable score snapshots consume Logistics Intelligence lineage. FISS produces explainable scores and does not mutate operational records.

