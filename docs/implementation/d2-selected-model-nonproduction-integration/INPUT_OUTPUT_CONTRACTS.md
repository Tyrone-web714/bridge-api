# Input And Output Contracts

## Input Contract

Every selected-D2 request must include authoritative TSR evidence and tenant context:

- `organizationId`
- `capabilityId`
- request or evidence identity
- authoritative source references
- tenant context
- known facts
- unknown facts
- safety and authority boundaries
- required output contract

Secret-like input is rejected.

## Output Contract

Provider-native output is normalized before consumption. Runtime validation requires source references, tenant context, uncertainty or limitations, and the capability-specific response field.

The model output never replaces authoritative TSR source data.
