# D1 Import Quarantine Policy

Status: QUARANTINE_POLICY_DEFINED

Historical import must be non-destructive. Invalid or ambiguous records must not silently enter representative datasets.

## Result Classes

| Class | Meaning |
| --- | --- |
| accepted | Record passes schema, tenant, provenance, taxonomy, timestamp, idempotency, and leakage checks. |
| warning | Record can be accepted but needs review for non-critical quality issue. |
| quarantined | Record may be recoverable but cannot be accepted until reviewed. |
| rejected | Record violates a hard rule and cannot be accepted as-is. |

## Safe Diagnostic Fields

Quarantine/error reports may include:

- row number or source record identity;
- reason code;
- field name;
- source system;
- Organization ID;
- safe diagnostic summary;
- import batch ID.

Reports must not include unnecessary customer PII, driver PII, addresses, invoice line details, raw notes, images, payment details, or credentials.
