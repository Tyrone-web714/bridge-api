# Driver State Model

Supported states:

- `OFF_DUTY`
- `ON_DUTY`
- `DRIVING`
- `AT_STOP`
- `DELIVERING`
- `WAITING`
- `RETURNING`
- `ROUTE_COMPLETE`
- `UNKNOWN`

Known states pass the operational-state rule. `UNKNOWN` or unrecognized states are marked for review or insufficient evidence depending on the rest of the assessment.
