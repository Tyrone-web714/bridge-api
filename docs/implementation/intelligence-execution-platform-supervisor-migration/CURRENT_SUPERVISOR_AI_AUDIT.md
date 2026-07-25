# Current Supervisor AI Audit

Audited service: `bridge-api/services/supervisorIntelligence.js`.

Active functions:

- `buildSourceContext(schedule, routeDate)`: deterministic source-context builder using repository queries and prediction engine calculations.
- `deterministicReport(sourceContext)`: deterministic fallback brief.
- `createAlerts(schedule, sourceContext)`: deterministic alert persistence.
- `runSchedule(schedule, options)`: active scheduled/manual report execution path.
- `runDueSchedules()`: scheduled worker claim-and-run loop.
- `start()` and `stop()`: background runner lifecycle.

Original direct provider path:

`runSchedule` -> `createAiNarrative` -> `aiProvider.createStructuredResponse` -> OpenAI Responses API -> parsed report -> `repositories.saveScheduledReport`.

Post-migration provider path:

`runSchedule` -> `supervisorAiAdapter.createDailyReportNarrative` -> `intelligenceExecution.execute` -> policy -> planner -> hosted provider adapter -> existing `aiProvider` implementation.

Classifications:

- Active production path: `runSchedule`, `runDueSchedules`, manual `POST /api/supervisor-intelligence/schedules/:id/run`, background `start()` runner.
- Active test/development path: deterministic report and contract checks in `scripts/check-supervisor-intelligence-contracts.cjs`.
- Unused but retained: none identified.
- Dead code candidate: none identified.
- Uncertain: none identified.