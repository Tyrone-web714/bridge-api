# API Protection Matrix

Public endpoints retained:

- `/health`
- `/ready`
- safe authentication/bootstrap endpoints

Protected by existing or adapted authentication:

- Admin and supervisor pages use admin session checks.
- Driver route, stop, delivery, document, hazard, and manifest operations use driver auth.
- Warehouse inventory confirmation endpoints now require warehouse employee ID plus PIN.
- Data import, driver registry, route manifest admin, account intelligence, heatmaps, geography, supervisor intelligence, and report endpoints continue to require admin sessions.

Centralized authorization middleware has been added for future endpoint-by-endpoint permission hardening.
