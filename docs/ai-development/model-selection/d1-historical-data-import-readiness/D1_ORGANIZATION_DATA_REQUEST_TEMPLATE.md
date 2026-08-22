# D1 Organization Data Request Template

Status: READY_FOR_OWNER_REVIEW

This is the practical request to provide to a future Organization's IT/data team.

## Request Summary

Truck-Safe Routing needs historical route execution and delivery outcome data to validate predictive readiness for route completion and delivery failure risk. This is not a request for model training approval or production activation.

## Required Files Or Exports

1. Historical route manifests/routes.
2. Historical route stops.
3. Historical delivery outcomes or stop statuses.
4. Account/customer reference IDs needed to join stops to accounts.
5. Outcome-code data dictionary.

## Required Columns

At minimum include:

- `organization_id`
- `source_system`
- `source_record_id`
- `route_id`
- `route_date`
- `route_status`
- `depot_or_start_location`
- `planned_start_at`
- `actual_completion_at`
- `stop_id`
- `stop_sequence`
- `account_id` or `account_number`
- `planned_arrival_at`
- `delivery_status`
- `non_delivery_reason` or source outcome code when not delivered
- `timezone`

## Optional Columns

- `actual_start_at`
- `planned_completion_at`
- `actual_arrival_at`
- `service_start_at`
- `service_end_at`
- `driver_assignment_id`
- `vehicle_assignment_id`
- exception/source outcome code
- cancellation/reschedule indicators

## Date Range

- Minimum for pipeline validation: enough records to test parsing, tenant ownership, joins, target derivation, and quarantine behavior.
- Desired for initial method selection: multiple weeks or months spanning normal and abnormal operations, with sufficient route and failure-event diversity.
- Desired for seasonal validation: substantially more history, ideally covering seasonal operating patterns.

Do not claim method readiness from row count alone.

## Format And Delivery

- CSV or XLSX preferred for first controlled dry-run.
- Include a data dictionary and outcome-code mapping.
- Include export date, source system, source export ID, timezone, and checksums.
- Do not include credentials, payment data, images, or unnecessary free-form notes.
