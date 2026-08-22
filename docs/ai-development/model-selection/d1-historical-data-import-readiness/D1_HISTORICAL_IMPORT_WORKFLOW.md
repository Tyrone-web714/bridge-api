# D1 Historical Import Workflow

Status: WORKFLOW_DEFINED_NO_IMPORT_EXECUTED

1. Organization data request.
2. Secure export received.
3. Source files registered with checksums and import manifest.
4. Dry-run mapping.
5. Validation and classification.
6. Quarantine/error review.
7. Owner or authorized operational approval.
8. Controlled import.
9. Post-import reconciliation.
10. Representative-data readiness check.
11. Wave-1 dataset freeze.
12. D1 method benchmarking.

No step may jump directly from raw export to training. No raw private Organization operational records should be committed to Git.

## Existing Five-Row File

`bridge-api/data/route-manifest-2026-06-20-827826.csv` remains non-representative local evidence:

- do not retrofit `organization_id`;
- do not invent actual outcomes;
- do not use it for D1 method selection;
- use it only for import mechanics or schema discussion if needed.
