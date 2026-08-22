# Delivery Outcome History Field Specification

Truck-Safe Routing prefers the Organization's original outcome and status codes plus documentation describing those codes. Do not translate source codes directly into Truck-Safe Routing categories. The controlled mapping layer will translate source codes into canonical outcomes after receipt.

| External field concept | Required | Description | Example format | Data type | Timezone requirement | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Organization code or company code | Required | Approved source-system code identifying the Organization. | `COMPANY_CODE` | string | n/a | Must match the export manifest. |
| Source system | Required | System that produced the outcome record. | `TMS_NAME` | string | n/a | Use a stable source-system label. |
| Source-system record ID | Required | Stable outcome, stop, or transaction record ID. | `OUTCOME_RECORD_ID` | string | n/a | Used for idempotency and reconciliation. |
| Route identifier | Required | Route ID associated with the outcome. | `ROUTE_ID` | string | n/a | Must join to route history where possible. |
| Stop identifier | Required | Stop ID associated with the outcome. | `STOP_ID` | string | n/a | Must join to stop history where possible. |
| Route date | Required | Service date for the outcome. | `YYYY-MM-DD` | date | Dataset or location timezone required | Should align with route and stop history. |
| Raw source outcome code | Required | Original delivery or stop outcome code. | `OUTCOME_CODE` | string | n/a | Preserve source value exactly. |
| Raw non-delivery reason code | Required when applicable | Original source non-delivery reason code. | `REASON_CODE` | string | n/a | Required for failed, refused, incomplete, or cancelled stops when available. |
| Safe code description | Required where available | Non-sensitive description of the source code. | `CODE_DESCRIPTION` | string | n/a | Do not include free-form personnel notes. |
| Status effective timestamp | Required where available | Timestamp when status became effective. | `YYYY-MM-DDTHH:MM:SS-05:00` | timestamp | Required when present | Include offset or documented local timezone. |
| Delivered indicator | Optional approved | Whether source records indicate delivery completed. | `true/false` | boolean | n/a | May be derived later from source code. |
| Partial delivery indicator | Optional approved | Whether source records indicate partial delivery. | `true/false` | boolean | n/a | May be derived later from source code. |
| Rescheduled indicator | Optional approved | Whether source records indicate reschedule. | `true/false` | boolean | n/a | Preserve source convention if different. |
| Cancelled indicator | Optional approved | Whether source records indicate cancellation. | `true/false` | boolean | n/a | Preserve source convention if different. |
