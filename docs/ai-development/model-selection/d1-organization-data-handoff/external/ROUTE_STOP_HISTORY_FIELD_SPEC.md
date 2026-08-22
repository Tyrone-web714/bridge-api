# Route Stop History Field Specification

| External field concept | Required | Description | Example format | Data type | Timezone requirement | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Organization code or company code | Required | Approved source-system code identifying the Organization. | `COMPANY_CODE` | string | n/a | Must be unambiguous for the export. |
| Source system | Required | System that produced the stop record. | `TMS_NAME` | string | n/a | Use a stable source-system label. |
| Source-system record ID | Required | Stable source record identity. | `STOP_RECORD_ID` | string | n/a | Used for idempotency and reconciliation. |
| Route identifier | Required | Route ID or route key joining the stop to a route. | `ROUTE_ID` | string | n/a | Must match route manifest history. |
| Stop identifier | Required | Stable stop ID or stop key. | `STOP_ID` | string | n/a | Required for stop-level joins. |
| Route date | Required | Service date for the stop route. | `YYYY-MM-DD` | date | Dataset or location timezone required | Should align with route manifest date. |
| Stop sequence | Required | Planned sequence number. | `INTEGER` | integer | n/a | Preserve original order. |
| Account/customer identifier | Required | Stable operational account or customer ID. | `ACCOUNT_ID` | string | n/a | Do not include contact-person information. |
| Planned arrival | Required where available | Planned stop arrival timestamp. | `YYYY-MM-DDTHH:MM:SS-05:00` | timestamp | Required when present | Include offset or documented local timezone. |
| Actual arrival | Required where available | Actual stop arrival timestamp. | `YYYY-MM-DDTHH:MM:SS-05:00` | timestamp | Required when present | Post-outcome timing used for validation and labels. |
| Service start | Optional approved | Timestamp when service began. | `YYYY-MM-DDTHH:MM:SS-05:00` | timestamp | Required when present | Post-outcome timing. |
| Service end | Optional approved | Timestamp when service ended. | `YYYY-MM-DDTHH:MM:SS-05:00` | timestamp | Required when present | Post-outcome timing. |
| Delivery status | Required | Source delivery status or stop status. | `STATUS_CODE` | string | n/a | Preserve original code. |
| Partial delivery indicator | Required where available | Whether only part of the planned delivery was completed. | `true/false` | boolean | n/a | Preserve source convention if different. |
| Non-delivery reason/code | Required for failed or incomplete stops | Source reason code for non-delivery or exception. | `REASON_CODE` | string | n/a | Preserve original code. |
| Rescheduled indicator | Optional approved | Whether stop was rescheduled. | `true/false` | boolean | n/a | Preserve source convention if different. |
| Cancelled indicator | Optional approved | Whether stop was cancelled. | `true/false` | boolean | n/a | Preserve source convention if different. |
| Exception code | Optional approved | Source operational exception code. | `EXCEPTION_CODE` | string | n/a | Preserve original code. |
