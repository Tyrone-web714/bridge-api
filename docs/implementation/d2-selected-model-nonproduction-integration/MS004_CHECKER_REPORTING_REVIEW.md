# MS-004 Checker Reporting Review

The MS-004 checker historically printed `hostedCalls=0` from the dry-run/generated benchmark evidence summary. That value refers to the original dry-run evidence surface and not to the later accepted LIVE_HOSTED D2 selection baseline.

The accepted MS-004 baseline at `7f4ef7538a894b9ae3fd3c654c22fcbc5e558904` records:

- `D2_MODEL_SELECTION_COMPLETE=true`
- `ALL_NINE_D2_CAPABILITIES_FINAL_MODEL_SELECTION_READY=true`
- completed LIVE_HOSTED calls: `237`
- failed calls: `35`
- measured spend: `$1.4305707`

The checker now reports the legacy count as `dryRunHostedCalls` and separately reports final D2 live hosted call totals, cost, and completion flags. Regression coverage rejects missing or inconsistent final D2 selection evidence.
