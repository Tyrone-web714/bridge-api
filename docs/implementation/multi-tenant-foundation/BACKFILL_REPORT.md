# Backfill Report

This phase assigns clearly classified internal development and test records to the bootstrap Organization:

- Truck-Safe Routing Development

The migration does not create or assign records to any real company.

## Backfilled Classes

- Users and audit/security records
- Drivers and driver sessions
- Warehouse employees
- Route manifests and stops
- Customer accounts and products
- Route inventory records
- Delivery orders, deductions, settlements, and documents
- Closeout documents
- Account AI insights and prediction records
- Supervisor alerts and scheduled reports

## Not Backfilled

Platform-global reference datasets remain outside tenant ownership. This includes low-clearance bridges and truck-restricted zones.

## Exceptions

`tenant_backfill_exceptions` is available for records that cannot be safely classified. No production exception report has been generated in this implementation task because production data was not modified.
