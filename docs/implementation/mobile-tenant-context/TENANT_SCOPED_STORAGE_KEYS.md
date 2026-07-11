# Tenant-Scoped Storage Keys

Organization-private local keys use this shape:

`<feature-prefix>/v2/org/<organizationId>/driver/<internalDriverId>/<data-type>/<entity>`

Examples:

- Assigned route: `@truck-safe-routing/assigned-route/v2/org/<org>/driver/<driver>/route/<date>`
- Stop queue: `@truck-safe-routing/route-stop-sync/v2/org/<org>/driver/<driver>/queue`
- Delivery queue: `@truck-safe-routing/delivery-operation-sync/v2/org/<org>/driver/<driver>/queue`
- Route events: `@truck-safe-routing/route-events/v2/org/<org>/driver/<driver>/queue`
- Barcode cache: `@truck-safe-routing/product-barcode/v2/org/<org>/driver/<driver>/barcode/<barcode>`

The mobile client does not accept arbitrary user-entered Organization IDs for local storage.