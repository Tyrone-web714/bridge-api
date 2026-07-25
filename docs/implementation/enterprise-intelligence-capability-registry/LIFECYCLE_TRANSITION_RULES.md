# Lifecycle Transition Rules

The transition validator is advisory and enforcement-oriented. It does not mutate lifecycle state.

Promotion to `PILOT` or `PRODUCTION` is conditionally allowed only with owner approval, benchmark evidence, rollback plan, security review, cost governance, policy approval, data readiness, and executor availability evidence.

Invalid lifecycle transitions fail closed.
