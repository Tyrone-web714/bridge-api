# Driver Profile Contract

Driver profiles are tenant-bound operational identities used for deterministic assessment context.

Required fields:

- `driverId`
- `organizationId`

Supported descriptive fields include `displayName`, `role`, `homeTerminal`, `licenseClass`, `endorsements`, and `policyAcknowledgements`.

Forbidden profile behavior:

- `employeeScoringEnabled: true`
- caller-supplied employee score
- caller-supplied employee rank
- caller-supplied provider or model controls

The profile contract exists to bind evidence to the correct tenant and driver context, not to evaluate employment performance.
