# Offline and Synchronization Audit

## Queue/Cache Inventory

| Store | Location | Scope Now | Required Scope |
| --- | --- | --- | --- |
| Assigned route cache | `routeManifestOfflineStore.js` | driver/date | Organization/driver/date/session |
| Stop status queue | `routeManifestOfflineStore.js` | driver/stop | Organization/session/operation |
| Delivery operation queue | `deliveryOfflineStore.js` | driver/payload | Organization/session/idempotency |
| Delivery notes cache | `deliveryOfflineStore.js` | identity/account | Organization/account/driver |
| Product barcode cache | `deliveryOfflineStore.js` | barcode | Organization/catalog/barcode |
| Route event queue | `routingApi.js` | session/payload | Organization/session/sequence |
| Printer selected device | `zebraPrinterService.js` | device | device plus logout policy |

## Risks

Duplicate replay, out-of-order inventory updates, stale photos/signatures, failed print confirmation, driver switch with old queue data, and future Organization switch without queue partitioning.

## Recommendation

Add operation IDs, tenant/session context, retry metadata, dependency groups, expiration, dedupe handling, and conflict policy before tenant migration.
