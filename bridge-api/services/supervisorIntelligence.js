const repositories = require('../db/repositories');
const predictionEngine = require('./predictionEngine');
const aiProvider = require('./aiProvider');

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    priorities: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    routeRisks: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    deliveryRisks: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    productSignals: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    recommendedActions: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    missingData: { type: 'array', items: { type: 'string' }, maxItems: 8 }
  },
  required: [
    'title',
    'summary',
    'priorities',
    'routeRisks',
    'deliveryRisks',
    'productSignals',
    'recommendedActions',
    'missingData'
  ]
};

let timer = null;
let tickInProgress = false;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function configuredIntervalMs() {
  const value = Number.parseInt(process.env.SUPERVISOR_REPORT_RUNNER_INTERVAL_MS, 10);
  return Number.isFinite(value) ? Math.max(value, 60_000) : 300_000;
}

function isEnabled() {
  return process.env.SUPERVISOR_REPORTS_ENABLED !== 'false';
}

function severityForRoute(route) {
  if (route.paceStatus === 'high_risk') return 'high';
  if (route.paceStatus === 'at_risk') return 'medium';
  return null;
}

async function supervisorDriverIds(supervisorUsername) {
  if (!supervisorUsername) return null;
  const drivers = await repositories.listDrivers({
    supervisorUsername,
    active: true,
    limit: 500
  });
  return new Set(drivers.map((driver) => driver.driverId));
}

async function buildSourceContext(schedule, routeDate = today()) {
  const allowedDriverIds = await supervisorDriverIds(schedule.supervisorUsername);
  const [rawRouteSignals, failureSignals, productSignals, undeliveredStops] = await Promise.all([
    repositories.listRouteCompletionSignals({ routeDate, limit: 300 }),
    repositories.getDeliveryFailureSignals({ routeDate, periodDays: 90 }),
    repositories.listProductDemandSignals({ routeDate, periodDays: 90, limit: 20 }),
    repositories.listUndeliveredRouteStops({ routeDate, limit: 300 })
  ]);
  const routeSignals = allowedDriverIds
    ? rawRouteSignals.filter((route) => allowedDriverIds.has(route.assignedDriverId))
    : rawRouteSignals;
  const visibleUndeliveredStops = allowedDriverIds
    ? undeliveredStops.filter((stop) => allowedDriverIds.has(stop.assignedDriverId))
    : undeliveredStops;

  const routePrediction = predictionEngine.buildRouteCompletionPredictions(routeSignals, { routeDate });
  const failurePrediction = predictionEngine.buildDeliveryFailurePrediction(failureSignals);
  const demandPrediction = predictionEngine.buildProductDemandForecast(productSignals, {
    sourcePeriodStart: failureSignals.currentPeriod?.periodStart,
    sourcePeriodEnd: failureSignals.currentPeriod?.periodEnd
  });

  return {
    routeDate,
    scope: schedule.supervisorUsername
      ? { type: 'supervisor_team', supervisorUsername: schedule.supervisorUsername }
      : { type: 'regional' },
    routePrediction,
    failurePrediction,
    demandPrediction,
    undeliveredStops: visibleUndeliveredStops.slice(0, 50).map((stop) => ({
      routeNumber: stop.routeNumber,
      stopSequence: stop.stopSequence,
      accountNumber: stop.accountNumber,
      accountName: stop.accountName,
      assignedDriverId: stop.assignedDriverId,
      nonDeliveryReason: stop.nonDeliveryReason,
      redeliveryStatus: stop.redeliveryStatus
    }))
  };
}

function deterministicReport(sourceContext) {
  const routes = sourceContext.routePrediction.routes || [];
  const atRiskRoutes = routes.filter((route) => ['at_risk', 'high_risk'].includes(route.paceStatus));
  const increasingProducts = (sourceContext.demandPrediction.products || [])
    .filter((product) => ['increasing', 'new_or_reactivated'].includes(product.direction))
    .slice(0, 5);
  const decreasingProducts = (sourceContext.demandPrediction.products || [])
    .filter((product) => product.direction === 'decreasing')
    .slice(0, 5);
  const undeliveredCount = sourceContext.undeliveredStops.length;

  const priorities = [];
  if (atRiskRoutes.length) priorities.push(`${atRiskRoutes.length} route(s) require schedule review.`);
  if (undeliveredCount) priorities.push(`${undeliveredCount} undelivered stop(s) require disposition.`);
  if (sourceContext.failurePrediction.riskLevel === 'high') {
    priorities.push('Recorded delivery-failure history is currently high risk.');
  }
  if (!priorities.length) priorities.push('No high-priority exception was detected from current recorded data.');

  return {
    title: `Supervisor Intelligence Brief - ${sourceContext.routeDate}`,
    summary: `${routes.length} route(s) analyzed, ${atRiskRoutes.length} at risk, and ${undeliveredCount} undelivered stop(s) recorded.`,
    priorities,
    routeRisks: atRiskRoutes.map((route) => (
      `${route.routeNumber || route.routeId}: ${route.paceStatus.replace('_', ' ')}; `
      + `${route.remainingStopCount} stop(s) remaining; `
      + `${Math.round(Number(route.scheduleVarianceMinutes) || 0)} minute schedule variance.`
    )),
    deliveryRisks: [
      `Network delivery-failure risk: ${sourceContext.failurePrediction.riskLevel}.`,
      ...sourceContext.undeliveredStops.slice(0, 6).map((stop) => (
        `${stop.routeNumber || 'Route'} stop ${stop.stopSequence}: `
        + `${stop.accountName || stop.accountNumber || 'account'} - `
        + `${stop.nonDeliveryReason || 'reason not recorded'}.`
      ))
    ],
    productSignals: [
      ...increasingProducts.map((product) => `${product.productName}: ${product.direction}.`),
      ...decreasingProducts.map((product) => `${product.productName}: decreasing recorded demand.`)
    ],
    recommendedActions: [
      ...(atRiskRoutes.length ? ['Review at-risk route timing and remaining stops.'] : []),
      ...(undeliveredCount ? ['Resolve or schedule redelivery for undelivered stops.'] : []),
      ...(increasingProducts.length ? ['Review increasing product signals against warehouse availability.'] : []),
      'Confirm source records before changing route, inventory, or customer decisions.'
    ],
    missingData: [
      ...(routes.some((route) => route.confidence === 'low')
        ? ['Some route predictions have limited completed-stop history.']
        : []),
      ...(sourceContext.demandPrediction.confidence === 'low'
        ? ['Product demand history is insufficient for a higher-confidence forecast.']
        : [])
    ]
  };
}

async function createAlerts(schedule, sourceContext) {
  const saved = [];
  for (const route of sourceContext.routePrediction.routes || []) {
    const severity = severityForRoute(route);
    if (!severity) continue;
    saved.push(await repositories.upsertSupervisorAlert({
      alertKey: `route-pace:${sourceContext.routeDate}:${route.routeId}`,
      supervisorUsername: schedule.supervisorUsername,
      alertType: 'route_completion_risk',
      severity,
      title: `${route.routeNumber || 'Route'} is ${route.paceStatus.replace('_', ' ')}`,
      message: `${route.remainingStopCount} stop(s) remain with ${Math.round(Number(route.scheduleVarianceMinutes) || 0)} minutes of recorded schedule variance.`,
      entityType: 'route_manifest',
      entityId: route.routeId,
      routeDate: sourceContext.routeDate,
      source: 'deterministic_prediction_engine',
      sourcePayload: route
    }));
  }

  for (const stop of sourceContext.undeliveredStops) {
    saved.push(await repositories.upsertSupervisorAlert({
      alertKey: `undelivered:${sourceContext.routeDate}:${stop.routeNumber}:${stop.stopSequence}:${stop.accountNumber || 'unknown'}`,
      supervisorUsername: schedule.supervisorUsername,
      alertType: 'undelivered_stop',
      severity: stop.redeliveryStatus === 'none' ? 'high' : 'medium',
      title: `Undelivered stop on ${stop.routeNumber || 'assigned route'}`,
      message: `${stop.accountName || stop.accountNumber || 'Account'} was not delivered: ${stop.nonDeliveryReason || 'reason not recorded'}.`,
      entityType: 'route_stop',
      entityId: `${stop.routeNumber || 'route'}:${stop.stopSequence}`,
      routeDate: sourceContext.routeDate,
      source: 'route_execution',
      sourcePayload: stop
    }));
  }
  return saved;
}

async function createAiNarrative(sourceContext, fallback) {
  if (!aiProvider.isConfigured()) return { content: fallback, generatedBy: 'rules_engine' };
  try {
    const result = await aiProvider.createStructuredResponse({
      endpoint: 'scheduled-supervisor-brief',
      instructions: [
        'You are generating a scheduled supervisor logistics brief for Truck-Safe Routing.',
        'Use only the source-of-truth predictions and exceptions supplied.',
        'Do not invent traffic, weather, inventory, customer behavior, or driver behavior.',
        'Treat deterministic predictions as calculated facts and preserve uncertainty.',
        'AI recommends only. Supervisors and backend records remain the source of truth.'
      ].join('\n'),
      input: sourceContext,
      schemaName: 'scheduled_supervisor_intelligence_brief',
      schema: REPORT_SCHEMA
    });
    return { content: result.parsed, generatedBy: `openai:${result.model}` };
  } catch (error) {
    return {
      content: {
        ...fallback,
        missingData: [
          ...fallback.missingData,
          `AI narrative unavailable: ${cleanText(error.message, 240)}`
        ]
      },
      generatedBy: 'rules_engine_ai_fallback',
      errorMessage: cleanText(error.message, 2000)
    };
  }
}

async function runSchedule(schedule, options = {}) {
  const routeDate = options.routeDate || today();
  const sourceContext = await buildSourceContext(schedule, routeDate);
  const alerts = await createAlerts(schedule, sourceContext);
  const fallback = deterministicReport(sourceContext);
  const narrative = await createAiNarrative(sourceContext, fallback);
  const report = await repositories.saveScheduledReport({
    scheduleId: schedule.id,
    reportType: schedule.reportType,
    supervisorUsername: schedule.supervisorUsername,
    routeDate,
    status: narrative.errorMessage ? 'completed_with_ai_fallback' : 'completed',
    title: narrative.content.title || fallback.title,
    summary: narrative.content.summary || fallback.summary,
    content: {
      ...narrative.content,
      deterministicSource: sourceContext,
      generatedAlertCount: alerts.length
    },
    generatedBy: narrative.generatedBy,
    errorMessage: narrative.errorMessage
  });
  return { report, alerts };
}

async function ensureDefaultSchedule() {
  const schedules = await repositories.listScheduledReportSchedules();
  if (schedules.length) return schedules[0];
  return repositories.upsertScheduledReportSchedule({
    id: 'default-daily-supervisor-brief',
    name: 'Daily Supervisor Intelligence Brief',
    reportType: 'supervisor_daily_brief',
    localHour: Number.parseInt(process.env.SUPERVISOR_REPORT_LOCAL_HOUR, 10) || 6,
    timezone: process.env.SUPERVISOR_REPORT_TIMEZONE || 'America/Chicago',
    enabled: true,
    createdBy: 'system'
  });
}

async function runDueSchedules() {
  if (!isEnabled() || tickInProgress) return [];
  tickInProgress = true;
  try {
    await ensureDefaultSchedule();
    const schedules = await repositories.claimDueScheduledReports(5);
    const results = [];
    for (const schedule of schedules) {
      try {
        results.push(await runSchedule(schedule));
      } catch (error) {
        await repositories.saveScheduledReport({
          scheduleId: schedule.id,
          reportType: schedule.reportType,
          supervisorUsername: schedule.supervisorUsername,
          routeDate: today(),
          status: 'failed',
          title: `${schedule.name} failed`,
          summary: 'The scheduled report could not be generated.',
          content: {},
          generatedBy: 'system',
          errorMessage: error.message
        }).catch(() => {});
        console.error(`[supervisor-intelligence] schedule ${schedule.id} failed: ${error.message}`);
      }
    }
    return results;
  } finally {
    tickInProgress = false;
  }
}

function start() {
  if (!isEnabled() || timer) return;
  setTimeout(() => runDueSchedules().catch((error) => {
    console.error(`[supervisor-intelligence] startup check failed: ${error.message}`);
  }), 5_000).unref();
  timer = setInterval(() => runDueSchedules().catch((error) => {
    console.error(`[supervisor-intelligence] runner failed: ${error.message}`);
  }), configuredIntervalMs());
  timer.unref();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = {
  buildSourceContext,
  deterministicReport,
  ensureDefaultSchedule,
  isEnabled,
  runDueSchedules,
  runSchedule,
  start,
  stop
};
