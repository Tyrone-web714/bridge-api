# Pilot Execution Waves

Wave 0: Scope freeze and evidence packet

- Freeze pilot Organization, users, drivers, devices, routes, dates, support owners, and success criteria.
- Confirm Google Maps, backup, hosting, secret, and device dependencies.
- Confirm AI production routing remains disabled.
- Produce the go/no-go evidence packet.

Wave 1: Environment readiness normalization

- Normalize pilot configuration and owner-decision gates.
- Add fail-closed disposable integration preflight.
- Preserve D1 OFF and D2 production routing OFF.

Wave 2: Disposable backend integration rehearsal

- Create/use disposable local PostgreSQL/PostGIS only.
- Apply migrations through 012 to the disposable database.
- Validate tenant-scoped route, stop, supervisor, BI/KPI, Logistics Intelligence, FISS,
  shared safety, and route-session data flows.
- Destroy or recreate the disposable environment after evidence capture.

Wave 3: Non-production mobile/device rehearsal

- Dry-run data onboarding.
- Install current APK on pilot-equivalent devices.
- Validate tenant-scoped login, route assignment, stop completion, notes/photos if included, and supervisor visibility.
- Validate offline/reconnect/restart replay.
- Validate alert delivery and log capture.

Wave 4: Field safety rehearsal

- Execute representative non-production or staged field route.
- Validate low bridge, truck restriction, no-truck, residential, hazard, route deviation, and stale-route behavior.
- Capture driver and supervisor evidence.

Wave 5: Limited live pilot

- Run one Organization, one depot, two to three drivers, and three to five routes per day.
- Keep D1 disabled and D2 production routing disabled.
- Monitor health, readiness, route operations, sync, auth, media, and tenant controls.

Wave 6: Pilot closeout

- Reconcile incidents, data integrity, tenant evidence, mobile logs, support outcomes, and route safety outcomes.
- Decide whether to expand, pause, remediate, or close pilot.
