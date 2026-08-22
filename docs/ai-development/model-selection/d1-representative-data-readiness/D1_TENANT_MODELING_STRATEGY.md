# D1 Tenant Modeling Strategy

Status: STRATEGY_DEFINED_EXECUTION_DEFERRED

D1 data is tenant-sensitive. All feature extraction, training, validation, scoring, and reporting must preserve `organization_id` boundaries and must not use one tenant's records to disclose or infer another tenant's activity.

## Default Strategy

Use a tenant-isolated evaluation strategy:

- extract features with `organization_id` filters;
- freeze datasets by tenant or by explicitly approved anonymized multi-tenant cohort;
- report row counts and quality metrics by tenant;
- prevent cross-tenant joins except through approved platform-level aggregate metadata;
- preserve source lineage for every prediction record;
- require human review for low confidence, missing evidence, stale evidence, or tenant mismatch.

## Model Scope Options

| Strategy | When acceptable | Constraints |
| --- | --- | --- |
| Per-tenant deterministic baseline | Always required as baseline | Must use only the tenant's records and approved deterministic logic. |
| Per-tenant statistical/ML model | Tenant has sufficient representative history | Requires tenant-specific train/validation/test split and threshold approval. |
| Shared architecture with tenant-specific calibration | Multiple tenants approve comparable schema and anonymized aggregate evaluation | Must not expose tenant data; calibration and reporting remain tenant-scoped. |
| Platform-level pooled model | Not approved by this package | Requires separate legal/privacy/governance approval and leakage analysis. |

## Minimum Controls

- Include `organization_id` in every dataset manifest and run record.
- Record tenant eligibility, exclusion reason, and data sufficiency.
- Reject records with missing or ambiguous tenant context.
- Treat production data use as separately approval-gated.
- Keep D1 offline until production orchestration is separately approved.
