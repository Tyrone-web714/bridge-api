# D1 External Data Request Handoff Record

Package version: `d1-organization-data-handoff-v0.1`

## Internal Governing Contract

This package is an external operational expression of:

- `docs/ai-development/model-selection/d1-representative-data-readiness/`
- `docs/ai-development/model-selection/d1-representative-data-freeze/`
- `docs/ai-development/model-selection/d1-historical-data-import-readiness/`

It does not create a second data contract.

## Wave-1 Capabilities

| Capability | Current status |
| --- | --- |
| `prediction.route_completion_forecast` | `SOURCE_DATA_NOT_AVAILABLE` |
| `prediction.delivery_failure_risk` | `SOURCE_DATA_NOT_AVAILABLE` |

D1 status remains `D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA`.

## External Artifacts Included

- Executive historical data request.
- Route manifest history field specification.
- Route stop history field specification.
- Delivery outcome history field specification.
- Outcome code dictionary template.
- Export manifest template.
- Pre-submission checklist.
- Route, stop, and delivery outcome CSV templates.
- Source-to-TSR mapping worksheet.
- Historical data availability questionnaire.
- Technical README.

## Privacy Boundary

The external request asks for stable operational identifiers instead of names or contact details. It excludes driver names, customer contact names, personal phone/email, home addresses, payment information, SSNs, HR records, medical information, images, credentials, and free-form personnel notes unless a separate approval explicitly changes the boundary.

## Current State

- Representative datasets frozen: `0`.
- Existing local five-row route manifest: unknown provenance, non-representative, not valid D1 model-selection evidence.
- Historical import readiness: prepared.
- No Organization historical import executed.
- No D1 model benchmarking authorized.
- No D2 change authorized.
- Production routing remains not activated.

## Expected Next Internal Step

After an authorized Organization export is received, run controlled dry-run parsing, tenant/provenance validation, schema validation, quality checks, target validation, leakage audit, and representativeness assessment before any D1 method benchmarking.
