# Legal Hold Implementation

`legal_holds` stores active and released holds by Organization, scope type, and scope ID. Legal holds block user purge preview, user anonymization, Organization purge preview deletion actions, and purge execution.

Only `lifecycle.legal_hold.manage` may apply or release holds. Platform-global holds can only be released by Platform Admin.

Legal authority and notification requirements remain `LEGAL_REVIEW_REQUIRED`.
