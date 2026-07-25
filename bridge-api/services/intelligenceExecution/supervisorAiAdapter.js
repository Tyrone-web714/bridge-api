const rbac = require('../rbac');
const { BOOTSTRAP_ORGANIZATION } = require('../tenantContext');
const intelligenceExecution = require('./index');
const { EXECUTION_PROFILES } = require('./constants');
const { renderPrompt, requirePrompt } = require('./promptRegistry');

const SUPERVISOR_DAILY_REPORT_CAPABILITY = 'supervisor.daily_operations_report';
const SUPERVISOR_DAILY_REPORT_SCHEMA = Object.freeze({
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
});

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function defaultSupervisorAuthContext(schedule = {}) {
  const role = rbac.ROLES.SUPERVISOR;
  return {
    authenticated: true,
    actorType: schedule.supervisorUsername ? 'scheduled_supervisor_report' : 'system_job',
    actorId: cleanText(schedule.supervisorUsername, 120) || 'system:supervisor-intelligence',
    displayName: cleanText(schedule.supervisorUsername, 120) || 'Supervisor Intelligence Scheduler',
    organizationId: schedule.organizationId || BOOTSTRAP_ORGANIZATION.id,
    role,
    approvedRole: role,
    permissions: rbac.permissionsForRole(role),
    sessionId: null
  };
}

function normalizeAuthContext(schedule, authContext = null) {
  if (authContext?.authenticated) {
    const approvedRole = rbac.normalizeRole(authContext.approvedRole || authContext.role) || rbac.ROLES.SUPERVISOR;
    return {
      ...authContext,
      approvedRole,
      role: authContext.role || approvedRole,
      organizationId: authContext.organizationId || (approvedRole === rbac.ROLES.PLATFORM_ADMIN ? BOOTSTRAP_ORGANIZATION.id : BOOTSTRAP_ORGANIZATION.id),
      permissions: Array.isArray(authContext.permissions) && authContext.permissions.length
        ? authContext.permissions
        : rbac.permissionsForRole(approvedRole)
    };
  }
  return defaultSupervisorAuthContext(schedule);
}

function buildSupervisorDailyReportRequest({ schedule = {}, sourceContext }) {
  const prompt = requirePrompt(SUPERVISOR_DAILY_REPORT_CAPABILITY);
  return {
    capability: SUPERVISOR_DAILY_REPORT_CAPABILITY,
    feature: 'supervisor_intelligence.scheduled_daily_report',
    taskType: 'SUMMARIZE',
    executionMode: 'SYNCHRONOUS',
    input: {
      endpoint: 'scheduled-supervisor-brief',
      instructions: renderPrompt(SUPERVISOR_DAILY_REPORT_CAPABILITY),
      input: sourceContext,
      schemaName: 'scheduled_supervisor_intelligence_brief',
      schema: SUPERVISOR_DAILY_REPORT_SCHEMA
    },
    inputClassification: 'ORGANIZATION_PRIVATE',
    dataSensitivity: 'ORGANIZATION_PRIVATE',
    safetyClassification: 'HIGH',
    desiredOutputFormat: 'json',
    outputSchema: SUPERVISOR_DAILY_REPORT_SCHEMA,
    executionProfile: EXECUTION_PROFILES.BALANCED,
    latencyTargetMs: 30000,
    maximumCostUsd: null,
    allowHostedInference: true,
    allowLocalInference: false,
    allowPremiumEscalation: false,
    requireHumanReview: false,
    metadata: {
      workflow: 'scheduled_supervisor_intelligence_report',
      scheduleId: cleanText(schedule.id, 160) || null,
      reportType: cleanText(schedule.reportType, 120) || 'supervisor_daily_brief',
      supervisorUsername: cleanText(schedule.supervisorUsername, 120) || null,
      promptId: prompt.id,
      promptVersion: prompt.version,
      advisoryOnly: true,
      employmentImpact: 'ADVISORY_ONLY_EMPLOYEE_RELATED',
      safetyImpact: 'NARRATIVE_MAY_NOT_OVERRIDE_RULES'
    }
  };
}

async function createDailyReportNarrative({ schedule = {}, sourceContext, fallback, authContext = null, req = null }) {
  const trustedAuthContext = normalizeAuthContext(schedule, authContext);
  const response = await intelligenceExecution.execute(
    trustedAuthContext,
    buildSupervisorDailyReportRequest({ schedule, sourceContext }),
    { req }
  );
  return {
    content: response.output || fallback,
    generatedBy: response.provider && response.model ? `${response.provider}:${response.model}` : 'intelligence_execution',
    usage: response.usage || null,
    estimatedCostUsd: response.estimatedCostUsd === undefined ? null : response.estimatedCostUsd,
    actualCostUsd: response.actualCostUsd ?? null,
    traceId: response.traceId,
    requestId: response.requestId,
    promptVersion: response.promptVersion,
    advisoryOnly: true,
    humanReviewRequired: response.humanReviewRequired
  };
}

module.exports = {
  SUPERVISOR_DAILY_REPORT_CAPABILITY,
  SUPERVISOR_DAILY_REPORT_SCHEMA,
  buildSupervisorDailyReportRequest,
  createDailyReportNarrative,
  defaultSupervisorAuthContext,
  normalizeAuthContext
};