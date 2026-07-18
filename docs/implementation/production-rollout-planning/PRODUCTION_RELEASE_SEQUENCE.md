# Production Release Sequence

Recommended sequence: preflight and backup first, then migration-first deployment because current `npm start` runs migrations before serving traffic.

1. Verify Git baseline and release commit.
2. Verify production database starting state with read-only preflight.
3. Capture production backup.
4. Verify backup restore capability or formally record restore drill approval.
5. Capture pre-deployment evidence.
6. Confirm Render env vars.
7. Confirm object storage env vars and access.
8. OWNER APPROVAL REQUIRED BEFORE EXECUTION: apply approved migrations or permit deployment startup migration.
9. Validate schema migration results.
10. OWNER APPROVAL REQUIRED BEFORE EXECUTION: deploy application.
11. Verify `/health`.
12. Verify `/ready`.
13. Verify authentication and RBAC denial.
14. Verify tenant isolation.
15. Verify admin/supervisor access.
16. Verify mobile API compatibility.
17. Verify route assignment/read.
18. Verify warehouse access.
19. Verify Shared Safety sanitized read.
20. Verify BI/KPI, Logistics Intelligence, and FISS read paths.
21. Monitor logs/errors.
22. Declare rollout result.

Do not execute this sequence during planning.
