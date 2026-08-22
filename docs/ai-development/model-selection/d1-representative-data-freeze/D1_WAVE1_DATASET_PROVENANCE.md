# D1 Wave 1 Dataset Provenance

Status: NO_REPRESENTATIVE_DATASET_FROZEN

## Provenance Findings

| Item | Value |
| --- | --- |
| Freeze package | D1 Wave 1 representative historical dataset freeze |
| Created date | 2026-08-22 |
| Repository | `C:\dev\bridge-api` |
| Backend | `C:\dev\bridge-api\bridge-api` |
| Branch | `legacy-public-url-final-cleanup` |
| Source commit at start | `e3b70b10f8da5bfdace4356078f7e18aa82f46bf` |
| Raw data committed | No |
| Production data read | No production database read was performed by this package |
| Production data mutated | No |
| Hosted calls | No |
| Training | No |
| D2 changed | No |

## Local Candidate Source Fingerprint

| Source | SHA-256 | Treatment |
| --- | --- | --- |
| `bridge-api/data/route-manifest-2026-06-20-827826.csv` | `13C5C47C047241B3CF94D78A69EB765ED1005FD54225965C4E926C374583C182` | Existing local planned-manifest file; not copied into freeze package; excluded from representative freeze. |

The source fingerprint is recorded to identify the inspected local file without exposing raw rows.

## Dataset Identity

No immutable representative dataset identity was assigned because no dataset met freeze criteria.

Reserved future dataset ID pattern:

- `d1.route_completion.representative.<organizationId>.vYYYYMMDD`
- `d1.delivery_failure_risk.representative.<organizationId>.vYYYYMMDD`

Any future dataset version must include a target definition version, feature manifest version, exclusion manifest version, split definition, row counts, content hash, source snapshot date, and approval record.
