# Backup Verification

| Check | Result |
| --- | --- |
| Backend Git bundle exists | True |
| Backend Git bundle readable | Verified with `git bundle verify`; list-heads exported. |
| Mobile Git bundle exists | True |
| Mobile Git bundle readable | Verified with `git bundle verify`; list-heads exported. |
| Mobile filesystem backup exists | True |
| Mobile backup file count plausible | 27751 files copied according to robocopy log. |
| Mobile backup size plausible | 344.73 m 344.73 m 0 0 0 0 copied according to robocopy log. |
| Evidence files exist | True |
| Active source files changed by RC-0 | No intentional source changes; only docs/evidence written under backend docs. |
| Files deleted | None. |
| Files staged | None; verified with `git diff --cached --name-only`. |
| Commits/pushes/builds/deployments | None performed. |
