# Source Control Policy

The standard workflow is:

1. Verify a clean baseline.
2. Implement within a scoped work package.
3. Run targeted validation.
4. Complete controlled review.
5. Stage explicit files or hunks only.
6. Create a logical commit when authorized.
7. Validate the exact committed tree.
8. Obtain owner approval before push.
9. Use normal push only; no force-push.
10. Create milestone tags only where authorized.
11. Preserve rollback expectations.
12. Keep production deployment separate.

Generated artifacts must be committed with the package that owns or updates their authoritative evidence. Mixed shared files must be staged by explicit path or hunk.

GitHub is the persistent source-control record, package commit history, remote recovery point, milestone tag host, local/remote comparison source, future pull-request review surface where authorized, and authoritative evidence of pushed status.

Local repository state, remote branch state, commit state, push state, and deployment state are distinct. Codex must never report `PUSHED` until the remote branch is verified to contain the commit. ChatGPT must not assume a commit was pushed based only on a local commit hash. No automatic GitHub monitoring by ChatGPT may be claimed.
