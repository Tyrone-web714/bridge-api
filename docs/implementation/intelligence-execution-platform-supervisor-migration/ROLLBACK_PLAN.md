# Rollback Plan

Repository rollback:

1. Revert `services/supervisorIntelligence.js` to its prior direct-provider implementation.
2. Remove `services/intelligenceExecution/supervisorAiAdapter.js` and `promptRegistry.js` if not otherwise used.
3. Remove `supervisor.daily_operations_report` from the capability registry and policy exception.
4. Revert provider adapter, planner, and validator supervisor capability additions.
5. Remove `scripts/check-ai-provider-boundaries.cjs` and `test:ai-architecture` package script.
6. Revert supervisor contract test additions and documentation updates.

Operational rollback if deployed later:

- Roll back to the previously deployed commit.
- No database rollback is required because AI-IEP-003 does not execute or add migrations.
- No object storage, Cloudflare, credential, or provider rollback is involved.