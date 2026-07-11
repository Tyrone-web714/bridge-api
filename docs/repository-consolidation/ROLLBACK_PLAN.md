# Repository Consolidation Rollback Plan

## Required Baselines

Before consolidation:

- Backend baseline commit: `bbb312618953018d7f13f791935d9664fae7f433` or newer approved clean commit.
- Backend remote: `origin https://github.com/Tyrone-web714/bridge-api.git`.
- Backend branch: `main`.
- Mobile full filesystem backup.
- Mobile `git status`, `git diff`, untracked inventory, and file inventory.
- Mobile baseline commit or Git bundle.
- Existing Render deploy ID.
- Existing mobile EAS build ID for latest installable pilot build.

## Failure Criteria

Rollback if:

- backend install/tests/start fail,
- `/health` or `/ready` fails,
- migrations run from wrong path,
- static bridge data fails to load,
- Render cannot deploy,
- mobile install or Expo config fails,
- EAS build cannot resolve assets/plugins/env,
- assigned route or offline queues regress,
- generated artifacts or secrets are staged.

## Rollback Steps

1. Stop consolidation branch work.
2. Keep existing `main` and Render deployment unchanged.
3. Revert or abandon consolidation branch.
4. Restore `C:\dev\tsr-mobile` from backup if mobile was changed.
5. Continue backend deployment from `C:\dev\bridge-api\bridge-api`.
6. Continue mobile builds from `C:\dev\tsr-mobile`.
7. Document failure cause before retry.
