const postgres = require('../db/postgres');
const rbac = require('./rbac');

const ENGINE_VERSION = 'fiss-foundation-v1';

const SUBJECT_TYPES = Object.freeze([
  'driver',
  'vehicle',
  'route',
  'customer',
  'supervisor',
  'route_dispatch_function',
  'depot_operations',
  'regional_operations',
  'organization',
  'fleet'
]);

const DEFAULT_COMPONENT_WEIGHTS = Object.freeze({
  safety: 0.25,
  efficiency: 0.2,
  reliability: 0.2,
  risk: 0.15,
  compliance: 0.1,
  performance: 0.1
});

function assertDatabaseReady() {
  if (!postgres.isDatabaseConfigured()) {
    const error = new Error('Fleet Intelligence Scoring requires PostgreSQL. DATABASE_URL is not configured.');
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
    const error = new Error('Organization context is required for Fleet Intelligence Scoring operations.');
    error.status = 403;
    error.code = 'ORGANIZATION_CONTEXT_REQUIRED';
    throw error;
  }
  return context.organizationId;
}

function requirePermission(context, permission) {
  if (!rbac.hasPermission(context, permission)) {
    const error = new Error('Insufficient permission for Fleet Intelligence Scoring operation.');
    error.status = 403;
    error.code = 'PERMISSION_DENIED';
    throw error;
  }
}

function normalizeSubjectType(value) {
  const subjectType = cleanText(value, 80);
  if (!SUBJECT_TYPES.includes(subjectType)) {
    const error = new Error('Unsupported Fleet Intelligence score subject type.');
    error.status = 400;
    error.code = 'UNSUPPORTED_SCORE_SUBJECT';
    throw error;
  }
  return subjectType;
}

function normalizeKey(value) {
  const key = cleanText(value, 140)
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!key) {
    const error = new Error('Score key is required.');
    error.status = 400;
    error.code = 'SCORE_KEY_REQUIRED';
    throw error;
  }
  return key;
}

function normalizeWeights(input = {}) {
  const source = toJson(input, {});
  const weights = {};
  for (const [key, value] of Object.entries(source)) {
    const weight = numeric(value);
    if (weight != null && weight >= 0) weights[normalizeKey(key)] = weight;
  }
  if (!Object.keys(weights).length) return { ...DEFAULT_COMPONENT_WEIGHTS };
  return weights;
}

function scoreBand(score) {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'watch';
  if (score >= 40) return 'risk';
  return 'critical';
}

function severityPenalty(severity) {
  if (severity === 'critical') return 28;
  if (severity === 'high') return 18;
  if (severity === 'medium') return 10;
  if (severity === 'low') return 4;
  return 0;
}

function statusPenalty(status) {
  if (['rejected', 'resolved', 'reviewed'].includes(status)) return 0;
  if (status === 'deferred') return 8;
  if (status === 'accepted') return 4;
  return 12;
}

function modelFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    scoreKey: row.score_key,
    name: row.name,
    description: row.description,
    subjectType: row.subject_type,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

function versionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    scoreModelId: row.score_model_id,
    version: row.version,
    scoringMethod: row.scoring_method,
    componentWeights: row.component_weights,
    thresholds: row.thresholds,
    formulaNotes: row.formula_notes,
    status: row.status,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    createdAt: row.created_at
  };
}

function snapshotFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    scoreModelId: row.score_model_id,
    scoreModelVersionId: row.score_model_version_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    scoreValue: Number(row.score_value),
    scoreBand: row.score_band,
    confidence: Number(row.confidence),
    explanation: row.explanation,
    lineage: row.lineage,
    sourceSummary: row.source_summary,
    calculationRunKey: row.calculation_run_key,
    immutableSnapshotId: row.immutable_snapshot_id,
    calculatedBy: row.calculated_by,
    calculatedAt: row.calculated_at
  };
}

function componentFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    scoreSnapshotId: row.score_snapshot_id,
    organizationId: row.organization_id,
    componentKey: row.component_key,
    componentName: row.component_name,
    weight: Number(row.weight),
    rawValue: row.raw_value == null ? null : Number(row.raw_value),
    normalizedScore: Number(row.normalized_score),
    contribution: Number(row.contribution),
    evidence: row.evidence,
    explanation: row.explanation,
    createdAt: row.created_at
  };
}

async function createScoreModel(context, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.FLEET_SCORE_MANAGE);
  const scoreKey = normalizeKey(input.scoreKey || input.score_key);
  const subjectType = normalizeSubjectType(input.subjectType || input.subject_type);
  const result = await postgres.query(`
    INSERT INTO fleet_score_models (
      organization_id, score_key, name, description, subject_type, status, created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
  `, [
    organizationId,
    scoreKey,
    cleanText(input.name, 180) || scoreKey,
    cleanNullableText(input.description, 1000),
    subjectType,
    ['draft', 'active', 'inactive', 'archived'].includes(input.status) ? input.status : 'draft',
    context.actorId || null
  ]);
  return modelFromRow(result.rows[0]);
}

async function listScoreModels(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.FLEET_SCORE_VIEW);
  const limit = boundedLimit(filters, 100, 250);
  const values = [organizationId, limit];
  const where = ['organization_id = $1', 'deleted_at IS NULL'];
  if (filters.subjectType || filters.subject_type) {
    values.push(normalizeSubjectType(filters.subjectType || filters.subject_type));
    where.push(`subject_type = $${values.length}`);
  }
  const result = await postgres.query(`
    SELECT * FROM fleet_score_models
    WHERE ${where.join(' AND ')}
    ORDER BY subject_type, name
    LIMIT $2
  `, values);
  return result.rows.map(modelFromRow);
}

async function getScoreModel(context, id) {
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.FLEET_SCORE_VIEW);
  const result = await postgres.query(
    'SELECT * FROM fleet_score_models WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
    [cleanText(id, 120), organizationId]
  );
  const model = modelFromRow(result.rows[0]);
  if (!model) {
    const error = new Error('Fleet score model not found.');
    error.status = 404;
    error.code = 'SCORE_MODEL_NOT_FOUND';
    throw error;
  }
  return model;
}

async function createModelVersion(context, scoreModelId, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.FLEET_SCORE_MANAGE);
  await getScoreModel(context, scoreModelId);
  const latest = await postgres.query(
    'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM fleet_score_model_versions WHERE score_model_id = $1',
    [cleanText(scoreModelId, 120)]
  );
  const status = ['draft', 'active', 'retired'].includes(input.status) ? input.status : 'draft';
  const result = await postgres.query(`
    INSERT INTO fleet_score_model_versions (
      score_model_id, version, scoring_method, component_weights, thresholds,
      formula_notes, status, effective_from, effective_to, created_by, approved_by
    )
    SELECT $1,$2,'weighted_components',$3::jsonb,$4::jsonb,$5,$6,
      COALESCE($7::timestamptz,NOW()),$8::timestamptz,$9,$10
    WHERE EXISTS (SELECT 1 FROM fleet_score_models WHERE id = $1 AND organization_id = $11)
    RETURNING *
  `, [
    cleanText(scoreModelId, 120),
    Number.parseInt(input.version, 10) || Number(latest.rows[0]?.next_version || 1),
    JSON.stringify(normalizeWeights(input.componentWeights || input.component_weights)),
    JSON.stringify(toJson(input.thresholds, {})),
    cleanNullableText(input.formulaNotes || input.formula_notes, 2000),
    status,
    input.effectiveFrom || input.effective_from || null,
    input.effectiveTo || input.effective_to || null,
    context.actorId || null,
    status === 'active' ? context.actorId || null : cleanNullableText(input.approvedBy || input.approved_by, 120),
    organizationId
  ]);
  return versionFromRow(result.rows[0]);
}

async function listModelVersions(context, scoreModelId) {
  await getScoreModel(context, scoreModelId);
  const result = await postgres.query(
    'SELECT * FROM fleet_score_model_versions WHERE score_model_id = $1 ORDER BY version DESC',
    [cleanText(scoreModelId, 120)]
  );
  return result.rows.map(versionFromRow);
}

async function activeVersion(scoreModelId, at = new Date()) {
  const result = await postgres.query(`
    SELECT * FROM fleet_score_model_versions
    WHERE score_model_id = $1
      AND status = 'active'
      AND effective_from <= $2
      AND (effective_to IS NULL OR effective_to >= $2)
    ORDER BY version DESC
    LIMIT 1
  `, [cleanText(scoreModelId, 120), at]);
  const version = versionFromRow(result.rows[0]);
  if (!version) {
    const error = new Error('No active Fleet Intelligence score model version is available.');
    error.status = 400;
    error.code = 'ACTIVE_SCORE_MODEL_VERSION_REQUIRED';
    throw error;
  }
  return version;
}

async function sourceRows(organizationId, subjectType, subjectId, periodStart, periodEnd) {
  const [signals, findings, recommendations, outcomes] = await Promise.all([
    postgres.query(`
      SELECT * FROM logistics_signals
      WHERE organization_id = $1 AND subject_type = $2 AND subject_id = $3
        AND detected_at BETWEEN $4 AND $5
      ORDER BY detected_at DESC
      LIMIT 200
    `, [organizationId, subjectType, subjectId, periodStart, periodEnd]),
    postgres.query(`
      SELECT * FROM logistics_findings
      WHERE organization_id = $1 AND subject_type = $2 AND subject_id = $3
        AND created_at BETWEEN $4 AND $5
      ORDER BY created_at DESC
      LIMIT 200
    `, [organizationId, subjectType, subjectId, periodStart, periodEnd]),
    postgres.query(`
      SELECT * FROM logistics_recommendations
      WHERE organization_id = $1 AND subject_type = $2 AND subject_id = $3
        AND created_at BETWEEN $4 AND $5
      ORDER BY created_at DESC
      LIMIT 200
    `, [organizationId, subjectType, subjectId, periodStart, periodEnd]),
    postgres.query(`
      SELECT o.* FROM logistics_outcomes o
      JOIN logistics_recommendations r ON r.id = o.recommendation_id
      WHERE o.organization_id = $1 AND r.subject_type = $2 AND r.subject_id = $3
        AND o.measured_at BETWEEN $4 AND $5
      ORDER BY o.measured_at DESC
      LIMIT 200
    `, [organizationId, subjectType, subjectId, periodStart, periodEnd])
  ]);
  return {
    signals: signals.rows,
    findings: findings.rows,
    recommendations: recommendations.rows,
    outcomes: outcomes.rows
  };
}

function componentScore(componentKey, rows) {
  const signalPenalty = rows.signals
    .filter((row) => matchesComponent(componentKey, row.signal_type))
    .reduce((total, row) => total + severityPenalty(row.severity), 0);
  const findingPenalty = rows.findings
    .filter((row) => matchesComponent(componentKey, row.finding_type))
    .reduce((total, row) => total + severityPenalty(row.severity), 0);
  const recommendationPenalty = rows.recommendations
    .filter((row) => matchesComponent(componentKey, row.recommendation_type))
    .reduce((total, row) => total + statusPenalty(row.status), 0);
  const outcomeCredit = rows.outcomes.reduce((total, row) => {
    const value = numeric(row.effectiveness);
    return total + (value == null ? 0 : value * 8);
  }, 0);
  const raw = signalPenalty + findingPenalty + recommendationPenalty - outcomeCredit;
  return {
    rawValue: raw,
    normalizedScore: clamp(100 - raw, 0, 100)
  };
}

function matchesComponent(componentKey, type = '') {
  const text = String(type || '').toLowerCase();
  if (componentKey === 'safety') return /safety|hazard|speed|risk/.test(text);
  if (componentKey === 'efficiency') return /delay|duration|efficiency|route/.test(text);
  if (componentKey === 'reliability') return /completion|service|reliability|stop/.test(text);
  if (componentKey === 'risk') return /risk|exception|variance|breach/.test(text);
  if (componentKey === 'compliance') return /compliance|review|shared_safety/.test(text);
  if (componentKey === 'performance') return /kpi|performance|score|outcome/.test(text);
  return text.includes(componentKey);
}

function calculateComponents(version, rows) {
  const weights = normalizeWeights(version.componentWeights);
  const totalWeight = Object.values(weights).reduce((total, weight) => total + weight, 0) || 1;
  return Object.entries(weights).map(([componentKey, rawWeight]) => {
    const weight = rawWeight / totalWeight;
    const result = componentScore(componentKey, rows);
    return {
      componentKey,
      componentName: componentKey.replace(/_/g, ' '),
      weight,
      rawValue: result.rawValue,
      normalizedScore: result.normalizedScore,
      contribution: result.normalizedScore * weight,
      evidence: {
        signalCount: rows.signals.filter((row) => matchesComponent(componentKey, row.signal_type)).length,
        findingCount: rows.findings.filter((row) => matchesComponent(componentKey, row.finding_type)).length,
        recommendationCount: rows.recommendations.filter((row) => matchesComponent(componentKey, row.recommendation_type)).length,
        outcomeCount: rows.outcomes.length
      },
      explanation: {
        summary: `${componentKey} score is based on matching Logistics Intelligence signals, findings, recommendations, and recorded outcomes.`,
        engineVersion: ENGINE_VERSION
      }
    };
  });
}

function buildRunKey(organizationId, modelId, versionId, subjectType, subjectId, periodStart, periodEnd, provided) {
  return cleanText(provided, 240)
    || [organizationId, modelId, versionId, subjectType, subjectId, periodStart.toISOString(), periodEnd.toISOString()].join(':').slice(0, 500);
}

async function calculateScore(context, scoreModelId, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.FLEET_SCORE_CALCULATE);
  const model = await getScoreModel(context, scoreModelId);
  const periodStart = new Date(input.periodStart || input.period_start || Date.now() - 24 * 60 * 60 * 1000);
  const periodEnd = new Date(input.periodEnd || input.period_end || Date.now());
  if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) || periodEnd < periodStart) {
    const error = new Error('Valid score period start and end are required.');
    error.status = 400;
    error.code = 'INVALID_SCORE_PERIOD';
    throw error;
  }
  const subjectType = normalizeSubjectType(input.subjectType || input.subject_type || model.subjectType);
  if (subjectType !== model.subjectType) {
    const error = new Error('Score subject type must match the score model subject type.');
    error.status = 400;
    error.code = 'SCORE_SUBJECT_MISMATCH';
    throw error;
  }
  const subjectId = cleanText(input.subjectId || input.subject_id || organizationId, 180);
  const version = input.scoreModelVersionId || input.score_model_version_id
    ? versionFromRow((await postgres.query(`
        SELECT mv.* FROM fleet_score_model_versions mv
        JOIN fleet_score_models m ON m.id = mv.score_model_id
        WHERE mv.id = $1 AND m.organization_id = $2 AND m.id = $3
      `, [cleanText(input.scoreModelVersionId || input.score_model_version_id, 120), organizationId, model.id])).rows[0])
    : await activeVersion(model.id, periodEnd);
  if (!version) {
    const error = new Error('Fleet score model version not found for this Organization.');
    error.status = 404;
    error.code = 'SCORE_MODEL_VERSION_NOT_FOUND';
    throw error;
  }
  const rows = await sourceRows(organizationId, subjectType, subjectId, periodStart, periodEnd);
  const components = calculateComponents(version, rows);
  const scoreValue = clamp(components.reduce((total, item) => total + item.contribution, 0), 0, 100);
  const confidence = clamp(0.45 + Math.min(rows.signals.length + rows.findings.length + rows.recommendations.length, 10) * 0.05, 0.45, 0.95);
  const runKey = buildRunKey(organizationId, model.id, version.id, subjectType, subjectId, periodStart, periodEnd, input.calculationRunKey || input.runKey);
  const lineage = {
    engineVersion: ENGINE_VERSION,
    scoreModelId: model.id,
    scoreModelVersionId: version.id,
    logisticsIntelligence: {
      signalIds: rows.signals.map((row) => row.id),
      findingIds: rows.findings.map((row) => row.id),
      recommendationIds: rows.recommendations.map((row) => row.id),
      outcomeIds: rows.outcomes.map((row) => row.id)
    }
  };
  const explanation = {
    summary: `Calculated ${model.name} from Logistics Intelligence outputs using score model version ${version.version}.`,
    largestContributors: components
      .slice()
      .sort((a, b) => a.contribution - b.contribution)
      .slice(0, 3)
      .map((item) => ({
        componentKey: item.componentKey,
        normalizedScore: Number(item.normalizedScore.toFixed(4)),
        contribution: Number(item.contribution.toFixed(4))
      })),
    confidence,
    recommendedImprovements: rows.recommendations.slice(0, 5).map((row) => ({
      id: row.id,
      recommendationType: row.recommendation_type,
      recommendation: row.recommendation
    }))
  };
  return postgres.withTransaction(async (client) => {
    const snapshotResult = await client.query(`
      INSERT INTO fleet_score_snapshots (
        organization_id, score_model_id, score_model_version_id, subject_type, subject_id,
        period_start, period_end, score_value, score_band, confidence, explanation,
        lineage, source_summary, calculation_run_key, calculated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15)
      ON CONFLICT (organization_id, calculation_run_key) WHERE calculation_run_key IS NOT NULL DO NOTHING
      RETURNING *
    `, [
      organizationId,
      model.id,
      version.id,
      subjectType,
      subjectId,
      periodStart,
      periodEnd,
      scoreValue,
      scoreBand(scoreValue),
      confidence,
      JSON.stringify(explanation),
      JSON.stringify(lineage),
      JSON.stringify({
        signalCount: rows.signals.length,
        findingCount: rows.findings.length,
        recommendationCount: rows.recommendations.length,
        outcomeCount: rows.outcomes.length
      }),
      runKey,
      context.actorId || null
    ]);
    const snapshot = snapshotResult.rows[0]
      ? snapshotFromRow(snapshotResult.rows[0])
      : await getSnapshotByRunKey(context, runKey);
    if (snapshotResult.rows[0]) {
      for (const component of components) {
        await client.query(`
          INSERT INTO fleet_score_component_snapshots (
            score_snapshot_id, organization_id, component_key, component_name, weight, raw_value,
            normalized_score, contribution, evidence, explanation
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
        `, [
          snapshot.id,
          organizationId,
          component.componentKey,
          component.componentName,
          component.weight,
          component.rawValue,
          component.normalizedScore,
          component.contribution,
          JSON.stringify(component.evidence),
          JSON.stringify(component.explanation)
        ]);
      }
    }
    return snapshot;
  });
}

async function getSnapshotByRunKey(context, runKey) {
  const organizationId = requireOrganizationContext(context);
  const result = await postgres.query(
    'SELECT * FROM fleet_score_snapshots WHERE organization_id = $1 AND calculation_run_key = $2',
    [organizationId, cleanText(runKey, 500)]
  );
  return snapshotFromRow(result.rows[0]);
}

async function listScoreSnapshots(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.FLEET_SCORE_VIEW);
  const limit = boundedLimit(filters, 100, 500);
  const values = [organizationId, limit];
  const where = ['organization_id = $1'];
  if (filters.subjectType || filters.subject_type) {
    values.push(normalizeSubjectType(filters.subjectType || filters.subject_type));
    where.push(`subject_type = $${values.length}`);
  }
  if (filters.subjectId || filters.subject_id) {
    values.push(cleanText(filters.subjectId || filters.subject_id, 180));
    where.push(`subject_id = $${values.length}`);
  }
  const result = await postgres.query(`
    SELECT * FROM fleet_score_snapshots
    WHERE ${where.join(' AND ')}
    ORDER BY calculated_at DESC
    LIMIT $2
  `, values);
  return result.rows.map(snapshotFromRow);
}

async function getScoreSnapshot(context, id) {
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.FLEET_SCORE_VIEW);
  const result = await postgres.query(
    'SELECT * FROM fleet_score_snapshots WHERE id = $1 AND organization_id = $2',
    [cleanText(id, 120), organizationId]
  );
  const snapshot = snapshotFromRow(result.rows[0]);
  if (!snapshot) {
    const error = new Error('Fleet score snapshot not found.');
    error.status = 404;
    error.code = 'SCORE_SNAPSHOT_NOT_FOUND';
    throw error;
  }
  const components = await postgres.query(
    'SELECT * FROM fleet_score_component_snapshots WHERE score_snapshot_id = $1 AND organization_id = $2 ORDER BY component_key',
    [snapshot.id, organizationId]
  );
  return {
    ...snapshot,
    components: components.rows.map(componentFromRow)
  };
}

async function createBenchmarkSet(context, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.FLEET_SCORE_BENCHMARK);
  const subjectType = normalizeSubjectType(input.subjectType || input.subject_type);
  const periodStart = new Date(input.periodStart || input.period_start || Date.now() - 24 * 60 * 60 * 1000);
  const periodEnd = new Date(input.periodEnd || input.period_end || Date.now());
  if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) || periodEnd < periodStart) {
    const error = new Error('Valid benchmark period start and end are required.');
    error.status = 400;
    error.code = 'INVALID_BENCHMARK_PERIOD';
    throw error;
  }
  const metrics = toJson(input.metrics, {});
  const result = await postgres.query(`
    INSERT INTO fleet_score_benchmark_sets (
      organization_id, name, benchmark_scope, subject_type, period_start, period_end,
      aggregate_method, population_size, metrics, anonymization_status, created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
    RETURNING *
  `, [
    organizationId,
    cleanText(input.name, 180) || 'Private Fleet Score Benchmark',
    'organization_private',
    subjectType,
    periodStart,
    periodEnd,
    ['average', 'median', 'percentile'].includes(input.aggregateMethod || input.aggregate_method) ? input.aggregateMethod || input.aggregate_method : 'median',
    Math.max(Number.parseInt(input.populationSize || input.population_size, 10) || 0, 0),
    JSON.stringify(metrics),
    'not_shared',
    context.actorId || null
  ]);
  return result.rows[0];
}

module.exports = {
  DEFAULT_COMPONENT_WEIGHTS,
  ENGINE_VERSION,
  SUBJECT_TYPES,
  calculateScore,
  createBenchmarkSet,
  createModelVersion,
  createScoreModel,
  getScoreModel,
  getScoreSnapshot,
  listModelVersions,
  listScoreModels,
  listScoreSnapshots
};
