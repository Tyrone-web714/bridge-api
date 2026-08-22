# D1 Delivery Outcome Taxonomy

Status: TAXONOMY_DEFINED

The taxonomy preserves materially different outcomes. Source systems may provide different codes; mappings must remain visible and versioned.

| Canonical outcome | Existing TSR alignment | Delivery failure label default | Notes |
| --- | --- | --- | --- |
| DELIVERED | stop status `completed` or `departed`; settlement `completed` | negative | Successful delivery. |
| PARTIALLY_DELIVERED | settlement partial quantities or partial completion | target-definition dependent | Do not collapse without approved rule. |
| CUSTOMER_UNAVAILABLE | existing reason `business_closed`; potential source codes for closed/unavailable | positive candidate | Preserve specific source code. |
| CUSTOMER_REFUSED | existing reason `customer_refused` | positive candidate | Existing TSR non-delivery reason. |
| INVENTORY_SHORTFALL | inventory/short/warehouse shortage codes | positive candidate | May be operational failure rather than customer failure. |
| TIME_WINDOW_FAILURE | existing reason `missed_time_window` | positive candidate | Existing TSR non-delivery reason. |
| ROUTE_OPERATION_FAILURE | dispatch/route/driver operational issue | positive candidate | Requires source code mapping. |
| VEHICLE_FAILURE | vehicle breakdown or unavailable vehicle | positive candidate | Optional vehicle context, not always present. |
| NO_PAYMENT | existing reason `no_payment` | positive candidate | Existing TSR non-delivery reason. |
| CANCELLED | cancelled order/stop/route before delivery attempt | excluded or separate target | Not necessarily delivery failure. |
| RESCHEDULED | planned future attempt | target-definition dependent | May be non-failure if proactively rescheduled. |
| UNKNOWN | unmapped, ambiguous, or missing outcome | unusable until reviewed | Must remain visible. |

Unknown or unmapped values must not be silently converted to delivered or failed.
