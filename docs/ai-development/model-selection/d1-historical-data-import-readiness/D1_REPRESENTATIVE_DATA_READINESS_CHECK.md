# D1 Representative Data Readiness Check

Status: CHECK_SPEC_DEFINED

A future checker must inspect imported historical data and report whether Wave-1 freeze may proceed. Import success alone is not enough.

## Required Report Fields

- Organization coverage.
- Date range and historical depth.
- Route count.
- Stop count.
- Account count.
- Target completeness.
- Delivery outcome distribution.
- Failure count and failure rate.
- Missingness by important field.
- Unknown provenance.
- Tenant errors.
- Leakage issues.
- Demo/test/synthetic contamination.
- Quarantine/rejection counts.

## Status Values

The checker must return one of the freeze package statuses:

- REPRESENTATIVE_DATASET_FROZEN_METHOD_SELECTION_READY
- DATASET_FROZEN_PIPELINE_VALIDATION_ONLY
- INSUFFICIENT_HISTORICAL_DEPTH
- INSUFFICIENT_TARGET_COVERAGE
- INSUFFICIENT_FAILURE_EVENT_COVERAGE
- DATA_QUALITY_BLOCKED
- TENANT_PROVENANCE_BLOCKED
- LEAKAGE_BLOCKED
- TARGET_DEFINITION_BLOCKED
- SOURCE_DATA_NOT_AVAILABLE

The checker must not declare method-selection readiness merely because an import succeeded.
