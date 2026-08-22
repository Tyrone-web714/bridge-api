# Route Manifest History Field Specification

| External field concept | Required | Description | Example format | Data type | Timezone requirement | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Organization code or company code | Required | Approved source-system code identifying the Organization. | `COMPANY_CODE` | string | n/a | Truck-Safe Routing maps this to internal Organization identity during controlled import. |
| Source system | Required | System that produced the record. | `TMS_NAME` | string | n/a | Use a stable source-system label. |
| Source-system record ID | Required | Stable record identity from the source system. | `ROUTE_RECORD_ID` | string | n/a | Used for idempotency and reconciliation. |
| Route identifier | Required | Stable route ID, route number, or route key. | `ROUTE_ID` | string | n/a | Must be stable across history where possible. |
| Route date | Required | Service date for the route. | `YYYY-MM-DD` | date | Dataset or location timezone required | Use the operating date, not export date. |
| Depot/location identifier | Required | Depot, distribution center, start location, or equivalent operating location. | `DEPOT_ID` | string | n/a | Use ID rather than address when possible. |
| Planned start | Required where available | Planned route start timestamp. | `YYYY-MM-DDTHH:MM:SS-05:00` | timestamp | Required | Include offset or documented local timezone. |
| Actual start | Optional approved | Actual route start timestamp. | `YYYY-MM-DDTHH:MM:SS-05:00` | timestamp | Required when present | Post-outcome timing used for validation and labels. |
| Planned completion | Optional approved | Planned completion timestamp or expected end. | `YYYY-MM-DDTHH:MM:SS-05:00` | timestamp | Required when present | Useful when available from planning system. |
| Actual completion | Required for route completion evaluation | Actual route completion timestamp. | `YYYY-MM-DDTHH:MM:SS-05:00` | timestamp | Required | Target evidence, not a pre-route feature. |
| Route status | Required where available | Route lifecycle or completion status. | `STATUS_CODE` | string | n/a | Preserve original code. |
| Planned stop count | Required where available | Number of planned stops. | `INTEGER` | integer | n/a | Used for quality and coverage checks. |
| Actual completed stop count | Required where available | Number of completed stops. | `INTEGER` | integer | n/a | May be derived from stop outcomes if not exported. |
| Cancelled indicator | Optional approved | Whether the route was cancelled. | `true/false` | boolean | n/a | Preserve source convention if different. |
| Aborted indicator | Optional approved | Whether the route began but did not complete. | `true/false` | boolean | n/a | Preserve source convention if different. |
| Reassignment indicator | Optional approved | Whether route assignment changed. | `true/false` | boolean | n/a | Useful for operations review when available. |
| Driver identifier | Optional only if approved | Stable Organization-scoped driver ID. | `DRIVER_ID` | string | n/a | Do not include driver name unless separately approved. |
| Vehicle identifier | Optional only if approved | Stable vehicle or asset ID. | `VEHICLE_ID` | string | n/a | Do not include unnecessary vehicle owner details. |
