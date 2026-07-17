const postgres = require('../db/postgres');
const rbac = require('./rbac');

const ENGINE_VERSION = 'logistics-foundation-v1';

const EVENT_CATALOG = Object.freeze([
  { type: 'route_delay', category: 'route_execution', signalType: 'route_running_behind_plan' },
  { type: 'stop_completed', category: 'delivery_execution', signalType: 'abnormal_stop_duration' },
  { type: 'delivery_exception', category: 'delivery_execution', signalType: 'delivery_exception_risk' },
  { type: 'inventory_discrepancy', category: 'inventory', signalType: 'inventory_variance' },
  { type: 'hazard_encountered', category: 'safety', signalType: 'safety_exposure' },
  { type: 'kpi_snapshot_created', category: 'bi_kpi', signalType: 'kpi_threshold_breach' },
  { type: 'shared_safety_record_published', category: 'shared_safety', signalType: 'new_shared_safety_exposure' }
]);

const FINDING_RULES = Object.freeze({
  route_running_behind_plan: {
    findingType: 'route_completion_risk',
    title: 'Route may miss planned completion window',
    recommendationType: 'supervisor_review_recommended',
    recommendation: 'Review route progress and decide whether dispatch intervention is needed.'
  },
  abnormal_stop_duration: {
    findingType: 'stop_service_time_risk',
    title: 'Stop service time is outside planned range',
    recommendationType: 'review_stop_service_time',
    recommendation: 'Review the stop and compare planned service minutes to actual service minutes.'
  },
  delivery_exception_risk: {
    findingType: 'delivery_exception_pattern',
    title: 'Delivery exception requires operational review',
    recommendationType: 'review_delivery_exception',
    recommendation: 'Review delivery exception notes, settlement state, and customer impact.'
  },
  inventory_variance: {
    findingType: 'inventory_variance',
    title: 'Inventory variance requires review',
    recommendationType: 'review_inventory_discrepancy',
    recommendation: 'Review loaded, delivered, returned, damaged, and missing quantities before closeout.'
  },
  safety_exposure: {
    findingType: 'safety_exposure',
    title: 'Driver encountered a truck-safety hazard',
    recommendationType: 'review_repeated_hazard_exposure',
    recommendation: 'Review the hazard encounter and determine whether private or shared safety follow-up is needed.'
  },
  kpi_threshold_breach: {
    findingType: 'kpi_threshold_breach',
    title: 'KPI threshold breach requires review',
    recommendationType: 'investigate_kpi_breach',
    recommendation: 'Open the BI/KPI snapshot and review the explanation trace before acting.'
  },
  new_shared_safety_exposure: {
    findingType: 'shared_safety_exposure',
    title: 'Shared safety intelligence may affect route planning',
    recommendationType: 'review_shared_safety_exposure',
    recommendation: 'Review the approved shared-safety record against active route planning assumptions.'
  }
});

function assertDatabaseReady() {
  if (!postgres.isDatabaseConfigured()) {
    const error = new Error('Logistics Intelligence requires PostgreSQL. DATABASE_URL is not configured.');
    error.status = 503;
    error.code = 'DATABASE_REQUIRED';
    throw error;
  }
}

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function cleanNullableText(value, maxLength = 500) {
  const cleaned = cleanText(value, maxLength);
  return cleaned || null;
}

function toJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function numeric(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function boundedLimit(filters = {}, fallback = 100, max = 500) {
  return Math.min(Math.max(Number.parseInt(filters.limit, 10) || fallback, 1), max);
}

function requireOrganizationContext(context) {
  if (!context?.authenticated) {
    const error = new Error('Authentication required.');
    error.status = 401;
    error.code = 'AUTHENTICATION_REQUIRED';
    throw error;
  }
  if (!context.organizationId) {
    const error = new Error('Organization context is required for Logistics Intelligence operations.');
    error.status = 403;
    error.code = 'ORGANIZATION_CONTEXT_REQUIRED';
    throw error;
  }
  return context.organizationId;
}

function requirePermission(context, permission) {
  if (!rbac.hasPermission(context, permission)) {
    const error = new Error('Insufficient permission for Logistics Intelligence operation.');
    error.status = 403;
    error.code = 'PERMISSION_DENIED';
    throw error;
  }
}

function normalizeSeverity(value, fallback = 'medium') {
  return ['info', 'low', 'medium', 'high', 'critical'].includes(value) ? value : fallback;
}

function priorityFromSeverity(severity) {
  if (severity === 'critical') return 'urgent';
  if (severity === 'high') return 'high';
  if (severity === 'low' || severity === 'info') return 'low';
  return 'medium';
}

function eventFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    eventType: row.event_type,
    eventCategory: row.event_category,
    sourceType: row.source_type,
    sourceId: row.source_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    routeId: row.route_id,
    driverId: row.driver_id,
    occurredAt: row.occurred_at,
    ingestedAt: row.ingested_at,
    payload: row.payload,
    schemaVersion: row.schema_version,
    correlationId: row.correlation_id,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    createdBy: row.created_by
  };
}

function signalFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    signalType: row.signal_type,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    value: row.value == null ? null : Number(row.value),
    severity: row.severity,
    confidence: Number(row.confidence),
    status: row.status,
    detectedAt: row.detected_at,
    expiresAt: row.expires_at,
    calculationVersion: row.calculation_version,
    explanation: row.explanation,
    lineage: row.lineage,
    sourceEventIds: row.source_event_ids,
    runKey: row.run_key,
    createdBy: row.created_by
  };
}

function findingFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    findingType: row.finding_type,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    title: row.title,
    explanation: row.explanation,
    severity: row.severity,
    confidence: Number(row.confidence),
    status: row.status,
    evidence: row.evidence,
    sourceSignalIds: row.source_signal_ids,
    lineage: row.lineage,
    runKey: row.run_key,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    createdBy: row.created_by
  };
}

function recommendationFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    findingId: row.finding_id,
    recommendationType: row.recommendation_type,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    recommendation: row.recommendation,
    rationale: row.rationale,
    priority: row.priority,
    confidence: Number(row.confidence),
    status: row.status,
    supportingFindingIds: row.supporting_finding_ids,
    lineage: row.lineage,
    runKey: row.run_key,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    createdBy: row.created_by
  };
}

function decisionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    recommendationId: row.recommendation_id,
    decidedBy: row.decided_by,
    decision: row.decision,
    reason: row.reason,
    decidedAt: row.decided_at,
    auditMetadata: row.audit_metadata
  };
}

function outcomeFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    recommendationId: row.recommendation_id,
    decisionId: row.decision_id,
    outcomeType: row.outcome_type,
    result: row.result,
    measuredAt: row.measured_at,
    effectiveness: row.effectiveness == null ? null : Number(row.effectiveness),
    notes: row.notes,
    metrics: row.metrics,
    recordedBy: row.recorded_by
  };
}

function eventSignalDefinition(event) {
  return EVENT_CATALOG.find((item) => item.type === event.eventType)
    || { type: event.eventType, category: event.eventCategory, signalType: 'operational_event_observed' };
}

function signalSeverity(event) {
  const payload = toJson(event.payload, {});
  if (event.eventType === 'kpi_snapshot_created') {
    if (payload.thresholdStatus === 'critical' || payload.threshold_status === 'critical') return 'critical';
    if (payload.thresholdStatus === 'warning' || payload.threshold_status === 'warning') return 'high';
    return 'info';
  }
  if (event.eventType === 'route_delay') {
    const delay = numeric(payload.delayMinutes || payload.delay_minutes);
    if (delay != null && delay >= 60) return 'critical';
    if (delay != null && delay >= 30) return 'high';
    return 'medium';
  }
  if (event.eventType === 'inventory_discrepancy') {
    const variance = Math.abs(numeric(payload.quantityVariance || payload.quantity_variance || payload.unaccountedQuantity || payload.unaccounted_quantity) || 0);
    if (variance >= 25) return 'critical';
    if (variance >= 10) return 'high';
    return 'medium';
  }
  if (event.eventType === 'hazard_encountered') return normalizeSeverity(payload.severity, 'high');
  if (event.eventType === 'delivery_exception') return normalizeSeverity(payload.severity, 'high');
  if (event.eventType === 'stop_completed') {
    const planned = numeric(payload.plannedServiceMinutes || payload.planned_service_minutes);
    const actual = numeric(payload.actualServiceMinutes || payload.actual_service_minutes);
    if (planned != null && actual != null && actual > planned * 2) return 'high';
  }
  return normalizeSeverity(payload.severity, 'medium');
}

function signalValue(event) {
  const payload = toJson(event.payload, {});
  return numeric(payload.value)
    ?? numeric(payload.delayMinutes || payload.delay_minutes)
    ?? numeric(payload.actualServiceMinutes || payload.actual_service_minutes)
    ?? numeric(payload.quantityVariance || payload.quantity_variance || payload.unaccountedQuantity || payload.unaccounted_quantity);
}

function buildRunKey(parts) {
  return parts.map((part) => cleanText(part, 160) || 'none').join(':').slice(0, 500);
}

async function ingestEvent(context, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.INTELLIGENCE_MANAGE);

  const eventType = cleanText(input.eventType || input.event_type, 120);
  if (!eventType) {
    const error = new Error('Logistics event type is required.');
    error.status = 400;
    error.code = 'EVENT_TYPE_REQUIRED';
    throw error;
  }
  const occurredAt = new Date(input.occurredAt || input.occurred_at || Date.now());
  if (!Number.isFinite(occurredAt.getTime())) {
    const error = new Error('A valid logistics event occurredAt timestamp is required.');
    error.status = 400;
    error.code = 'INVALID_OCCURRED_AT';
    throw error;
  }
  const catalogItem = EVENT_CATALOG.find((item) => item.type === eventType);
  const payload = toJson(input.payload, {});
  const idempotencyKey = cleanNullableText(input.idempotencyKey || input.idempotency_key, 240);

  const result = await postgres.query(`
    INSERT INTO logistics_events (
      organization_id, event_type, event_category, source_type, source_id, subject_type, subject_id,
      route_id, driver_id, occurred_at, payload, schema_version, correlation_id, idempotency_key, created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15)
    ON CONFLICT (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE SET
      ingested_at = logistics_events.ingested_at
    RETURNING *
  `, [
    organizationId,
    eventType,
    cleanText(input.eventCategory || input.event_category || catalogItem?.category || 'operations', 120),
    cleanText(input.sourceType || input.source_type || 'manual', 120),
    cleanNullableText(input.sourceId || input.source_id, 180),
    cleanText(input.subjectType || input.subject_type || 'organization', 120),
    cleanText(input.subjectId || input.subject_id || organizationId, 180),
    cleanNullableText(input.routeId || input.route_id, 180),
    cleanNullableText(input.driverId || input.driver_id, 180),
    occurredAt,
    JSON.stringify(payload),
    Number.parseInt(input.schemaVersion || input.schema_version, 10) || 1,
    cleanNullableText(input.correlationId || input.correlation_id, 180),
    idempotencyKey,
    context.actorId || null
  ]);
  return eventFromRow(result.rows[0]);
}

async function listEvents(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.INTELLIGENCE_VIEW);
  const limit = boundedLimit(filters, 100, 500);
  const values = [organizationId, limit];
  const where = ['organization_id = $1'];
  if (filters.eventType || filters.event_type) {
    values.push(cleanText(filters.eventType || filters.event_type, 120));
    where.push(`event_type = $${values.length}`);
  }
  if (filters.subjectType || filters.subject_type) {
    values.push(cleanText(filters.subjectType || filters.subject_type, 120));
    where.push(`subject_type = $${values.length}`);
  }
  if (filters.subjectId || filters.subject_id) {
    values.push(cleanText(filters.subjectId || filters.subject_id, 180));
    where.push(`subject_id = $${values.length}`);
  }
  const result = await postgres.query(`
    SELECT * FROM logistics_events
    WHERE ${where.join(' AND ')}
    ORDER BY occurred_at DESC
    LIMIT $2
  `, values);
  return result.rows.map(eventFromRow);
}

async function createSignalFromEvent(context, event) {
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.INTELLIGENCE_REVIEW);
  const definition = eventSignalDefinition(event);
  const severity = signalSeverity(event);
  const value = signalValue(event);
  const runKey = buildRunKey([organizationId, 'signal', event.id, definition.signalType]);
  const explanation = {
    summary: `Detected ${definition.signalType} from ${event.eventType}.`,
    sourceEventType: event.eventType,
    engineVersion: ENGINE_VERSION
  };
  const lineage = {
    engineVersion: ENGINE_VERSION,
    sourceEvents: [{ id: event.id, type: event.eventType, sourceType: event.sourceType, sourceId: event.sourceId }],
    biKpi: event.eventType === 'kpi_snapshot_created' ? toJson(event.payload, {}) : null,
    sharedSafety: event.eventType === 'shared_safety_record_published' ? toJson(event.payload, {}) : null
  };
  const result = await postgres.query(`
    INSERT INTO logistics_signals (
      organization_id, signal_type, subject_type, subject_id, value, severity, confidence,
      explanation, lineage, source_event_ids, run_key, created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12)
    ON CONFLICT (organization_id, run_key) WHERE run_key IS NOT NULL DO UPDATE SET
      status = logistics_signals.status
    RETURNING *
  `, [
    organizationId,
    definition.signalType,
    event.subjectType,
    event.subjectId,
    value,
    severity,
    severity === 'critical' ? 0.9 : severity === 'high' ? 0.8 : 0.65,
    JSON.stringify(explanation),
    JSON.stringify(lineage),
    JSON.stringify([event.id]),
    runKey,
    context.actorId || null
  ]);
  await postgres.query('UPDATE logistics_events SET status = $1 WHERE id = $2 AND organization_id = $3', ['processed', event.id, organizationId]);
  return signalFromRow(result.rows[0]);
}

async function runSignalDetection(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.INTELLIGENCE_REVIEW);
  const limit = boundedLimit(filters, 50, 250);
  const result = await postgres.query(`
    SELECT * FROM logistics_events
    WHERE organization_id = $1
      AND status IN ('ingested', 'processed')
    ORDER BY occurred_at DESC
    LIMIT $2
  `, [organizationId, limit]);
  const signals = [];
  for (const row of result.rows) {
    signals.push(await createSignalFromEvent(context, eventFromRow(row)));
  }
  return signals;
}

async function listSignals(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.INTELLIGENCE_VIEW);
  const limit = boundedLimit(filters, 100, 500);
  const values = [organizationId, limit];
  const where = ['organization_id = $1'];
  if (filters.status) {
    values.push(cleanText(filters.status, 40));
    where.push(`status = $${values.length}`);
  }
  if (filters.signalType || filters.signal_type) {
    values.push(cleanText(filters.signalType || filters.signal_type, 120));
    where.push(`signal_type = $${values.length}`);
  }
  const result = await postgres.query(`
    SELECT * FROM logistics_signals
    WHERE ${where.join(' AND ')}
    ORDER BY detected_at DESC
    LIMIT $2
  `, values);
  return result.rows.map(signalFromRow);
}

async function createFindingFromSignal(context, signal) {
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.INTELLIGENCE_REVIEW);
  const rule = FINDING_RULES[signal.signalType] || {
    findingType: 'operational_signal_review',
    title: 'Operational signal requires review',
    recommendationType: 'review_operational_signal',
    recommendation: 'Review the signal and supporting lineage before operational action.'
  };
  const runKey = buildRunKey([organizationId, 'finding', signal.id, rule.findingType]);
  const result = await postgres.query(`
    INSERT INTO logistics_findings (
      organization_id, finding_type, subject_type, subject_id, title, explanation, severity,
      confidence, evidence, source_signal_ids, lineage, run_key, created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13)
    ON CONFLICT (organization_id, run_key) WHERE run_key IS NOT NULL DO UPDATE SET
      status = logistics_findings.status
    RETURNING *
  `, [
    organizationId,
    rule.findingType,
    signal.subjectType,
    signal.subjectId,
    rule.title,
    `${rule.title}. Source signal: ${signal.signalType}.`,
    signal.severity,
    signal.confidence,
    JSON.stringify({ signalType: signal.signalType, explanation: signal.explanation, value: signal.value }),
    JSON.stringify([signal.id]),
    JSON.stringify({ engineVersion: ENGINE_VERSION, sourceSignals: [signal.id], signalLineage: signal.lineage }),
    runKey,
    context.actorId || null
  ]);
  return findingFromRow(result.rows[0]);
}

async function runFindingDetection(context, filters = {}) {
  const signals = await listSignals(context, { ...filters, status: filters.status || 'active', limit: boundedLimit(filters, 50, 250) });
  const findings = [];
  for (const signal of signals.filter((item) => ['medium', 'high', 'critical'].includes(item.severity))) {
    findings.push(await createFindingFromSignal(context, signal));
  }
  return findings;
}

async function listFindings(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.INTELLIGENCE_VIEW);
  const limit = boundedLimit(filters, 100, 500);
  const values = [organizationId, limit];
  const where = ['organization_id = $1'];
  if (filters.status) {
    values.push(cleanText(filters.status, 40));
    where.push(`status = $${values.length}`);
  }
  const result = await postgres.query(`
    SELECT * FROM logistics_findings
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $2
  `, values);
  return result.rows.map(findingFromRow);
}

async function createRecommendationFromFinding(context, finding) {
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.INTELLIGENCE_REVIEW);
  const rule = Object.values(FINDING_RULES).find((item) => item.findingType === finding.findingType) || {
    recommendationType: 'review_finding',
    recommendation: 'Review the finding and decide whether operational action is appropriate.'
  };
  const runKey = buildRunKey([organizationId, 'recommendation', finding.id, rule.recommendationType]);
  const result = await postgres.query(`
    INSERT INTO logistics_recommendations (
      organization_id, finding_id, recommendation_type, subject_type, subject_id, recommendation,
      rationale, priority, confidence, supporting_finding_ids, lineage, run_key, created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13)
    ON CONFLICT (organization_id, run_key) WHERE run_key IS NOT NULL DO UPDATE SET
      status = logistics_recommendations.status
    RETURNING *
  `, [
    organizationId,
    finding.id,
    rule.recommendationType,
    finding.subjectType,
    finding.subjectId,
    rule.recommendation,
    `Recommendation generated from ${finding.findingType}. It is advisory only and requires human decision before action.`,
    priorityFromSeverity(finding.severity),
    finding.confidence,
    JSON.stringify([finding.id]),
    JSON.stringify({ engineVersion: ENGINE_VERSION, sourceFindings: [finding.id], findingLineage: finding.lineage }),
    runKey,
    context.actorId || null
  ]);
  return recommendationFromRow(result.rows[0]);
}

async function runRecommendationGeneration(context, filters = {}) {
  const findings = await listFindings(context, { ...filters, status: filters.status || 'open', limit: boundedLimit(filters, 50, 250) });
  const recommendations = [];
  for (const finding of findings) {
    recommendations.push(await createRecommendationFromFinding(context, finding));
  }
  return recommendations;
}

async function processIntelligence(context, filters = {}) {
  const signals = await runSignalDetection(context, filters);
  const findings = await runFindingDetection(context, filters);
  const recommendations = await runRecommendationGeneration(context, filters);
  return { signals, findings, recommendations };
}

async function listRecommendations(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.RECOMMENDATION_VIEW);
  const limit = boundedLimit(filters, 100, 500);
  const values = [organizationId, limit];
  const where = ['organization_id = $1'];
  if (filters.status) {
    values.push(cleanText(filters.status, 40));
    where.push(`status = $${values.length}`);
  }
  const result = await postgres.query(`
    SELECT * FROM logistics_recommendations
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT $2
  `, values);
  return result.rows.map(recommendationFromRow);
}

async function getRecommendation(context, id) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.RECOMMENDATION_VIEW);
  const result = await postgres.query(
    'SELECT * FROM logistics_recommendations WHERE id = $1 AND organization_id = $2',
    [cleanText(id, 120), organizationId]
  );
  const recommendation = recommendationFromRow(result.rows[0]);
  if (!recommendation) {
    const error = new Error('Logistics recommendation not found.');
    error.status = 404;
    error.code = 'RECOMMENDATION_NOT_FOUND';
    throw error;
  }
  return recommendation;
}

async function decideRecommendation(context, id, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.RECOMMENDATION_DECIDE);
  const recommendation = await getRecommendation(context, id);
  const decision = cleanText(input.decision, 40);
  if (!['accepted', 'rejected', 'deferred', 'marked_reviewed'].includes(decision)) {
    const error = new Error('Decision must be accepted, rejected, deferred, or marked_reviewed.');
    error.status = 400;
    error.code = 'INVALID_DECISION';
    throw error;
  }
  const status = decision === 'marked_reviewed' ? 'reviewed' : decision;
  return postgres.withTransaction(async (client) => {
    const decisionResult = await client.query(`
      INSERT INTO logistics_decisions (organization_id, recommendation_id, decided_by, decision, reason, audit_metadata)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb)
      RETURNING *
    `, [
      organizationId,
      recommendation.id,
      context.actorId || 'unknown',
      decision,
      cleanNullableText(input.reason, 2000),
      JSON.stringify({ actorType: context.actorType || null, sessionId: context.sessionId || null })
    ]);
    await client.query(
      'UPDATE logistics_recommendations SET status = $1 WHERE id = $2 AND organization_id = $3',
      [status, recommendation.id, organizationId]
    );
    return decisionFromRow(decisionResult.rows[0]);
  });
}

async function recordOutcome(context, recommendationId, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.OUTCOME_RECORD);
  const recommendation = await getRecommendation(context, recommendationId);
  const effectiveness = numeric(input.effectiveness);
  if (effectiveness != null && (effectiveness < 0 || effectiveness > 1)) {
    const error = new Error('Outcome effectiveness must be between 0 and 1.');
    error.status = 400;
    error.code = 'INVALID_EFFECTIVENESS';
    throw error;
  }
  const result = await postgres.query(`
    INSERT INTO logistics_outcomes (
      organization_id, recommendation_id, decision_id, outcome_type, result,
      measured_at, effectiveness, notes, metrics, recorded_by
    )
    VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz,NOW()),$7,$8,$9::jsonb,$10)
    RETURNING *
  `, [
    organizationId,
    recommendation.id,
    cleanNullableText(input.decisionId || input.decision_id, 120),
    cleanText(input.outcomeType || input.outcome_type || 'manual_follow_up', 120),
    cleanText(input.result || 'recorded', 120),
    input.measuredAt || input.measured_at || null,
    effectiveness,
    cleanNullableText(input.notes, 2000),
    JSON.stringify(toJson(input.metrics, {})),
    context.actorId || null
  ]);
  return outcomeFromRow(result.rows[0]);
}

async function listOutcomes(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.INTELLIGENCE_VIEW);
  const limit = boundedLimit(filters, 100, 500);
  const result = await postgres.query(`
    SELECT * FROM logistics_outcomes
    WHERE organization_id = $1
    ORDER BY measured_at DESC
    LIMIT $2
  `, [organizationId, limit]);
  return result.rows.map(outcomeFromRow);
}

module.exports = {
  ENGINE_VERSION,
  EVENT_CATALOG,
  FINDING_RULES,
  createFindingFromSignal,
  createRecommendationFromFinding,
  createSignalFromEvent,
  decideRecommendation,
  getRecommendation,
  ingestEvent,
  listEvents,
  listFindings,
  listOutcomes,
  listRecommendations,
  listSignals,
  processIntelligence,
  recordOutcome,
  runFindingDetection,
  runRecommendationGeneration,
  runSignalDetection
};
