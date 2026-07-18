# API and Permissions

New route family: `/api/data-lifecycle`.

Permissions:

- `lifecycle.user.deactivate`
- `lifecycle.user.reactivate`
- `lifecycle.user.request_delete`
- `lifecycle.user.review_delete`
- `lifecycle.user.purge`
- `lifecycle.organization.terminate`
- `lifecycle.organization.review`
- `lifecycle.organization.purge`
- `lifecycle.export`
- `lifecycle.legal_hold.manage`
- `lifecycle.dsr.manage`
- `platform.lifecycle.support`

Organization Admin receives scoped user lifecycle, export, and DSR permissions. Platform Admin receives all permissions. Supervisor, Driver, and Warehouse Employee do not receive destructive lifecycle administration by default.
