# Tenant Isolation

Every Logistics Intelligence table includes `organization_id`.

Every service operation resolves Organization context from the authenticated server-side auth context. Clients do not get to select arbitrary Organization identifiers to access private operational data.

List and get operations filter by `organization_id`. Runtime validation confirms that Organization B cannot read Organization A recommendations.
