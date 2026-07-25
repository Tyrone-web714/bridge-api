# Call Graph

Manual run:

`routes/supervisorIntelligence.js` `POST /schedules/:id/run`
-> `supervisorIntelligence.runSchedule(schedule, { routeDate, authContext, req })`
-> `buildSourceContext`
-> repository queries and `predictionEngine`
-> `createAlerts`
-> `deterministicReport`
-> `supervisorAiAdapter.createDailyReportNarrative`
-> `intelligenceExecution.execute`
-> capability lookup `supervisor.daily_operations_report`
-> `evaluatePolicy`
-> `createExecutionPlan`
-> `executeHostedModel`
-> `aiProvider.createStructuredResponse`
-> output validation
-> compatibility response
-> `repositories.saveScheduledReport`
-> route JSON response.

Background runner:

`server.js` startup
-> `supervisorIntelligence.start()`
-> `runDueSchedules()`
-> `repositories.claimDueScheduledReports(5)`
-> `runSchedule(schedule)`
-> same execution chain as above, using trusted system/supervisor fallback auth context.

Fallback path:

If hosted narrative execution fails or provider configuration is missing, `createAiNarrative` returns deterministic fallback content with generatedBy `rules_engine_ai_fallback` and preserves the previous `completed_with_ai_fallback` report status behavior.