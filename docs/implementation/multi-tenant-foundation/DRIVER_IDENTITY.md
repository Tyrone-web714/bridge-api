# Driver Identity

Truck-Safe Routing uses two driver identifiers:

1. Permanent internal driver ID
2. Organization-scoped company driver number

The company driver number remains the operational identifier used by drivers and existing mobile workflows. Driver names must not be used as identifiers.

The migration adds:

- `drivers.internal_driver_id`
- `drivers.organization_id`
- `drivers.company_driver_number`

Uniqueness rule:

- `organization_id + company_driver_number`

The bootstrap Development Organization preserves existing `driver_id` values so current test IDs such as `827826` keep working in mobile and API workflows.

For future non-bootstrap Organizations, repository helpers can generate deterministic legacy storage IDs while preserving the company driver number separately.
