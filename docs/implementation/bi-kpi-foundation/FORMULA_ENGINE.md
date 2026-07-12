# Formula Engine

Service: `bridge-api/services/biKpi.js`.

The engine uses structured JSON formulas. It does not use `eval()` or `new Function()`.

Supported operations:

- `input`
- `constant`
- `sum`
- `average`
- `ratio`
- `percentage`
- `weighted_score`
- `threshold_score`
- `capped`
- `min`
- `max`
- `subtract`
- `multiply`
- `divide`
- `conditional`

Safety behavior:

- Unsupported operations are rejected.
- Missing numeric inputs fail explicitly.
- Division by zero is rejected unless the formula explicitly sets `onZero: "zero"`.
- Rounding rules are deterministic.
- Calculation trace is stored with each snapshot.
