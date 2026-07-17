# TSR Organization Termination and Data Exit Policy

**Status:** ARCHITECTURE DESIGNED

Organization termination SHALL follow staged lifecycle management:

1. Termination requested
2. Operational shutdown
3. Authorized data export
4. Read-only retention
5. Purge eligibility review
6. Controlled purge
7. Audited result

Organization termination SHALL disable new operational activity and Organization-specific integrations where appropriate. It SHALL NOT expose another Organization's data. It SHALL NOT delete Platform-global safety intelligence solely because the terminating Organization originated a submission.

Data export rights, export format, delivery method, and retention after exit are `POLICY_DECISION_REQUIRED`.
