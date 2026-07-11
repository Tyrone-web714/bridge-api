# Organization Context Enforcement

Trusted Organization context is derived from authenticated session state:

- Admin session claims.
- Driver session claims.
- Warehouse employee authentication context.

Client-supplied `organization_id` is not accepted as the trusted tenant source.

Implemented Organization-scoped query changes:

- Recent destinations now filter by `organization_id`.
- Recent destination record keys include Organization ID.
- Warehouse inventory workflows attach WAREHOUSE_EMPLOYEE context after ID plus PIN authentication.

Existing repository helpers from the multi-tenant foundation continue to scope drivers, route manifests, route stops, delivery documents, and inventory workflows.
