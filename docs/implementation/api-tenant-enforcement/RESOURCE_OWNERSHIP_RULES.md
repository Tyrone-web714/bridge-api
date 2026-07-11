# Resource Ownership Rules

Rules applied in this phase:

- Organization-private admin/backing APIs require authenticated Organization context and permission.
- Recent destinations are Organization-private.
- Warehouse confirmation actions execute as WAREHOUSE_EMPLOYEE with Organization context.
- Delivery-note photo access requires admin authentication.
- Cross-tenant assertion failures produce security audit events.

Repository-level Organization filters remain the primary resource ownership enforcement for drivers, manifests, stops, inventory, route documents, and route sessions.
