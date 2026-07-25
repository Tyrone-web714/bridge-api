# Cost Accounting Foundation

Money helpers use micro-USD integer arithmetic in `money.js` to avoid floating-point precision for request-ceiling comparisons.

AI-IEP-001 records deterministic cost as `0.000000`. Unknown cost is represented as `null`, not zero. Malformed, negative, and over-precision request cost ceilings are rejected during request normalization.

Hosted pricing is not invented. If future provider pricing is unknown, usage can be recorded while estimated and actual cost remain unknown.

No customer billing, subscription tier, markup, or invoicing feature is implemented.
