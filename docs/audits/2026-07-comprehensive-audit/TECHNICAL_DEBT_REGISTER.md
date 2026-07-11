# Technical Debt Register

See `technical-debt.csv` for the machine-readable register.

## Blocking Debt

- TSR-AUD-001: missing Organization tenant keys.
- TSR-AUD-002: unscoped/unversioned APIs.
- TSR-AUD-003: mobile offline queues lack Organization context.
- TSR-AUD-004: auth claims lack Organization context.

## Non-Blocking but Important Debt

Large route modules, mobile dependency advisories, mobile source-control gaps, missing mobile tests, unverified scale tests, and incomplete BI/LIE/FISS implementation.
