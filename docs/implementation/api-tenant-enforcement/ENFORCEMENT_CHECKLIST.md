# Enforcement Checklist

Completed:

- Central `authorization.enforceApiTenantPolicy` mounted before routes.
- Critical and High admin/backing APIs mapped to permissions.
- Protected record-changing admin route-manifest, driver, data import, geography, intelligence, and report paths.
- Protected Google Places proxy endpoints with admin-or-driver authentication.
- Scoped recent destinations by trusted Organization context.
- Attached warehouse auth context after ID plus PIN verification.
- Protected delivery-note photo route.
- Added source-level API tenant-enforcement tests.

Deferred:

- Full route-by-route migration from local `requireAdminSession` helpers to reusable middleware arrays.
- Platform Admin support workflow with explicit target Organization.
- Full endpoint-level live HTTP integration matrix.
