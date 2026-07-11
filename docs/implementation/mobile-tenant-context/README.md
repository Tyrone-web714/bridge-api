# Mobile Tenant Context

This phase adds trusted mobile Organization context, tenant-scoped local storage, offline queue protections, and legacy local-data migration safeguards.

Implemented scope:

- Driver session normalization now requires `organizationId`, `internalDriverId`, and `companyDriverNumber` from the authenticated backend response.
- Organization-private AsyncStorage caches and queues now use tenant-scoped v2 keys.
- Legacy unscoped route, stop, delivery, notes, barcode, and route-event data is preserved and either migrated only when clearly mapped to the authenticated driver or quarantined when ambiguous.
- Offline queue sync/removal/failure paths use the queued operation tenant context.
- Delivery photo files are stored under Organization/internal-driver directories.
- Mobile protected API calls continue using centralized authenticated headers.

Out of scope:

- APK/AAB build.
- Tenant switching.
- Mobile navigation redesign.
- Route execution, printing, camera, map marker, BI, KPI, AI, billing, or Shared Safety feature expansion.