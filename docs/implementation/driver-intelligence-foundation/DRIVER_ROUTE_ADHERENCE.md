# Driver Route Adherence

Route adherence compares the driver's current position with the assigned route geometry. The rule produces:

- `PASS` when the position is within the advisory threshold.
- `ADVISORY` when distance exceeds the advisory threshold.
- `WARNING` when distance exceeds the warning threshold or the off-route duration exceeds policy.
- `INSUFFICIENT_EVIDENCE` when route geometry or position evidence is missing.

The rule is advisory and does not alter dispatch, navigation, or production routing.
