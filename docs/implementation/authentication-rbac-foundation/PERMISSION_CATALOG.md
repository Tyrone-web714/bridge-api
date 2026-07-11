# Permission Catalog

Stable permission families implemented in `services/rbac.js`:

- `platform.organizations.manage`
- `platform.configure`
- `billing.manage`
- `shared_safety.approve`
- `users.manage`
- `drivers.view`
- `drivers.manage`
- `vehicles.manage`
- `routes.view`
- `routes.manage`
- `routes.assign`
- `stops.manage`
- `accounts.view`
- `delivery.operate`
- `warehouse.confirm`
- `hazards.submit`
- `hazards.review`
- `dashboard.view`
- `dashboard.manage`
- `reports.view`
- `reports.export`
- `route_replay.view`
- `audit.view`

Authorization is deny-by-default. A role provides default permissions, but authorization checks evaluate permissions independently from role labels.
