# Git History Strategy

## Compared Approaches

| Approach | Benefits | Risks |
| --- | --- | --- |
| Keep backend history as monorepo history | Preserves backend/docs history; lowest Render risk. | Mobile history must be imported separately. |
| Mobile Git subtree | Can preserve mobile history under `apps/mobile`. | More complex with dirty mobile state. |
| History-preserving merge | Preserves full mobile history. | Complex root history and harder rollback. |
| Mobile single baseline commit | Simple and low risk after backup. | Mobile pre-import history remains outside monorepo. |
| New repo importing both histories | Clean name from day one. | Highest Render/GitHub cutover risk. |

## Recommendation

Use existing backend repository history as monorepo history and import mobile as a single baseline commit after the mobile repository is backed up and committed.

Rationale:

- Backend deployment continuity is the highest priority.
- Mobile currently has no remote and a dirty working tree.
- A mobile baseline commit plus full backup preserves rollback without a fragile history import.
- Mobile history can be retained separately in a temporary private mobile repository or Git bundle.

## Effects

| Area | Effect |
| --- | --- |
| GitHub history | Backend/docs history remains primary; mobile appears from baseline import. |
| Render deployment | Least disruption because backend repository remains connected. |
| Mobile release history | Preserve externally through mobile baseline repo/bundle; monorepo starts mobile history at import. |
