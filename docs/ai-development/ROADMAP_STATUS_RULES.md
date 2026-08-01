# Roadmap Status Rules

`COMMITTED_LOCAL` requires a local Git commit that corresponds to the package.

`PUSHED` requires a fetched remote reference and evidence that the remote branch contains the package commit.

`VALIDATED` requires required package tests and approved regression validation against an identifiable tree.

`DEPLOYED` requires explicit deployment evidence, deployment target, deployed commit, owner authorization, and post-deployment validation.

Do not infer `PUSHED` merely because a commit exists locally. Do not infer `VALIDATED` merely because a commit exists. Do not infer production readiness from any repository status.
