# Owner Approval Gate

## Planning Package Status

This package is advisory. It does not authorize file moves, repository renames, mobile import, deployment changes, package-manager changes, or multi-tenant implementation.

## Required Owner Approvals Before Execution

1. Approve target repository model.
2. Approve GitHub repository name and visibility.
3. Approve mobile preservation and remote strategy.
4. Approve Git-history strategy.
5. Approve package/workspace strategy.
6. Approve Render deployment transition strategy.
7. Approve rollback baseline evidence list.
8. Approve consolidation branch creation.
9. Approve cutover/rename/archive sequence.

## Recommended Decisions

| Topic | Recommendation |
| --- | --- |
| Repository model | Convert existing backend repository into monorepo in phases. |
| GitHub name | Keep `bridge-api` during transition; rename to `truck-safe-routing` after validation. |
| Visibility | Private during consolidation and pilot preparation. |
| Local root | Continue using `C:\dev\bridge-api` during transition; optionally rename local folder after remote rename and validation. |
| Default branch | `main`. |
| Git history | Preserve backend history; import mobile as baseline commit after mobile backup/baseline; preserve mobile history externally. |
| Package manager | npm, app-local installs first; npm workspaces only after app validation. |
| Shared packages | Start with none; add `shared-types` only when tenant contracts require it. |

## Stop Conditions

Stop and request review if mobile backup is incomplete, generated artifacts are mixed with source, backend deployment cannot be validated, EAS build cannot run from target path, secrets appear in staged files, or Render root changes are required before validation.
