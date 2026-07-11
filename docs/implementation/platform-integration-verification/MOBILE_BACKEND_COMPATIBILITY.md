# Mobile Backend Compatibility

## Overall Result

Passed automated compatibility checks and source review. Physical-device runtime validation remains required.

## Key Files Reviewed

- `apps/mobile/src/app/config/api.js`
- `apps/mobile/src/app/services/tenantContext.js`
- `apps/mobile/src/app/services/driverSession.js`
- `apps/mobile/src/app/services/deliveryNotesApi.js`
- `apps/mobile/src/app/services/routingApi.js`
- Route, delivery notes, inventory, warehouse inventory, settlement, and map screens under `apps/mobile/src/app/screens/`

## Confirmed Compatibility Points

- Standalone physical-device builds require `EXPO_PUBLIC_API_BASE_URL` and do not silently fall back to localhost.
- Driver login uses `/api/driver-auth/login`.
- Driver session storage requires `organizationId`, `internalDriverId`, and `companyDriverNumber`.
- Authenticated requests can attach bearer session headers through shared helpers.
- Tenant-scoped storage keys include Organization ID and internal driver ID.
- Company driver number remains available where operationally appropriate.
- Ambiguous legacy local data has a quarantine path.

## Protected Endpoint Areas Reviewed

Route manifests, assigned routes, stops, delivery operations, delivery notes/photos, hazards, inventory/closeout, recent destinations, Places/Street View/photo proxy usage where currently present, route events, and existing status/API support calls.

## Remaining Runtime Validation

Confirm physical APK backend URL, phone login trusted context, assigned route load, offline queue survival/reconnect sync-once behavior, and logout/user-change local data isolation.
