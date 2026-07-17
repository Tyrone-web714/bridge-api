# TSR Data Subject Request Architecture

**Status:** ARCHITECTURE DESIGNED

TSR SHALL support jurisdiction-neutral request categories:

- ACCESS
- EXPORT
- CORRECTION
- DELETION
- RESTRICTION

Requests SHALL be evaluated. Possible outcomes include:

- DELETE
- ANONYMIZE
- PARTIALLY DELETE
- RETAIN UNDER POLICY
- RETAIN UNDER LEGAL HOLD
- REJECT WITH DOCUMENTED REASON

TSR SHALL NOT claim legal obligations that have not been reviewed. Jurisdiction-specific requirements are `LEGAL_REVIEW_REQUIRED`.
