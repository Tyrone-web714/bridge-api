# TSR Legal Hold Architecture

**Status:** ARCHITECTURE DESIGNED

Legal holds SHALL block normal purge eligibility for relevant records. Holds SHALL apply across user deletion, Organization termination, retention jobs, object-storage cleanup, and administrator cleanup operations.

Legal holds SHALL be explicitly authorized, auditable, scoped, reviewable, and removable only by authorized personnel.

Legal hold authority, notification requirements, and jurisdiction-specific procedures are `LEGAL_REVIEW_REQUIRED`.
