# KPI Definition Model

KPI definitions are Organization-scoped and include:

- `id`
- `organization_id`
- `key`
- `name`
- `description`
- `category`
- `unit`
- `direction`
- `status`
- `owner_permission`
- `created_by`
- timestamps
- soft-delete field

`organization_id + key` is unique for active definitions.

Initial supported KPI families include planned hours, actual hours, planned-vs-actual efficiency, cases delivered, return percentage, stops completed, stops missed, route completion percentage, on-time completion, delivery exceptions, damaged-product percentage, inventory variance, driver safety events, route deviation, speed events, and fuel or mileage efficiency where data exists.
