# D1 Wave 1 Canonical Data Contract

Status: CANONICAL_CONTRACT_DEFINED

Wave-1 D1 import readiness requires canonical operational history, not a provider-specific export format. Source adapters must map CSV, XLSX, database exports, APIs, ERP/WMS/TMS files, or TMS route histories into these canonical concepts.

## Canonical Entities

| Canonical entity | TSR schema mapping | Required for | Assessment |
| --- | --- | --- | --- |
| Historical route manifest | `daily_route_manifests` concept | Route completion and delivery failure context | REQUIRED |
| Historical route stop | `daily_route_stops` concept | Route completion, delivery failure target, stop features | REQUIRED |
| Historical delivery outcome | `daily_route_stops.status`, `non_delivery_reason`, delivery settlements/outcome evidence | Delivery failure risk | REQUIRED |
| Account/customer reference | `customer_accounts`, `daily_route_stops.account_number`, `account_orders.account_number` | Delivery failure grouping and account context | REQUIRED_FOR_DELIVERY_FAILURE |
| Route/depot context | `daily_route_manifests.start_location`, route number/date, depot/source location | Route diversity, representativeness | REQUIRED |
| Driver assignment | `daily_route_manifests.assigned_driver_id` | Optional route context where approved | OPTIONAL_APPROVED |
| Vehicle assignment | Fleet/route vehicle context where available | Optional route context | OPTIONAL_REQUIRES_JUSTIFICATION |
| Source provenance | Import batch metadata plus source system/record identity | All accepted records | REQUIRED |

## Canonical Import Boundary

Every accepted record must carry:

- `organization_id`;
- `source_system`;
- `source_record_id`;
- `source_export_id` or import batch identity;
- `schema_version`;
- `mapping_version`;
- `timezone`;
- safe source row reference.

Records missing deterministic Organization ownership must fail closed or quarantine. Organization ownership must not be inferred from customer names, driver names, addresses, or free-form notes.
