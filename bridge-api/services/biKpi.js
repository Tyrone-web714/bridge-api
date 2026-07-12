const postgres = require('../db/postgres');
const rbac = require('./rbac');

const ALLOWED_FORMULA_OPERATIONS = new Set([
  'input',
  'constant',
  'sum',
  'average',
  'ratio',
  'percentage',
  'weighted_score',
  'threshold_score',
  'capped',
  'min',
  'max',
  'subtract',
  'multiply',
  'divide',
  'conditional'
]);

const KPI_FAMILIES = Object.freeze([
  { key: 'planned_hours', name: 'Planned Hours', category: 'route_efficiency', unit: 'hours', direction: 'target' },
  { key: 'actual_hours', name: 'Actual Hours', category: 'route_efficiency', unit: 'hours', direction: 'lower_is_better' },
  { key: 'planned_vs_actual_efficiency', name: 'Planned vs Actual Efficiency', category: 'route_efficiency', unit: 'percent', direction: 'higher_is_better' },
  { key: 'cases_delivered', name: 'Cases Delivered', category: 'delivery_volume', unit: 'cases', direction: 'higher_is_better' },
  { key: 'return_percentage', name: 'Return Percentage', category: 'delivery_quality', unit: 'percent', direction: 'lower_is_better' },
  { key: 'stops_completed', name: 'Stops Completed', category: 'route_completion', unit: 'count', direction: 'higher_is_better' },
  { key: 'stops_missed', name: 'Stops Missed', category: 'route_completion', unit: 'count', direction: 'lower_is_better' },
  { key: 'route_completion_percentage', name: 'Route Completion Percentage', category: 'route_completion', unit: 'percent', direction: 'higher_is_better' },
  { key: 'on_time_completion', name: 'On-Time Completion', category: 'service', unit: 'percent', direction: 'higher_is_better' },
  { key: 'delivery_exceptions', name: 'Delivery Exceptions', category: 'exceptions', unit: 'count', direction: 'lower_is_better' },
  { key: 'damaged_product_percentage', name: 'Damaged-Product Percentage', category: 'inventory', unit: 'percent', direction: 'lower_is_better' },
  { key: 'inventory_variance', name: 'Inventory Variance', category: 'inventory', unit: 'units', direction: 'lower_is_better' },
  { key: 'driver_safety_events', name: 'Driver Safety Events', category: 'safety', unit: 'count', direction: 'lower_is_better' },
  { key: 'route_deviation', name: 'Route Deviation', category: 'navigation', unit: 'count', direction: 'lower_is_better' },
  { key: 'speed_events', name: 'Speed Events', category: 'safety', unit: 'count', direction: 'lower_is_better' },
  { key: 'fuel_or_mileage_efficiency', name: 'Fuel or Mileage Efficiency', category: 'fleet_efficiency', unit: 'ratio', direction: 'higher_is_better' }
]);

function assertDatabaseReady() {
  if (!postgres.isDatabaseConfigured()) {
    const error = new Error('BI/KPI foundation requires PostgreSQL. DATABASE_URL is not configured.');
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

function normalizeKey(value) {
  const key = cleanText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!key) {
    const error = new Error('KPI key is required.');
    error.status = 400;
    error.code = 'KPI_KEY_REQUIRED';
    throw error;
  }
  return key;
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

function requireOrganizationContext(context) {
  if (!context?.authenticated) {
    const error = new Error('Authentication required.');
    error.status = 401;
    error.code = 'AUTHENTICATION_REQUIRED';
    throw error;
  }
  if (!context.organizationId) {
    const error = new Error('Organization context is required for BI/KPI operations.');
    error.status = 403;
    error.code = 'ORGANIZATION_CONTEXT_REQUIRED';
    throw error;
  }
  return context.organizationId;
}

function requirePermission(context, permission) {
  if (!rbac.hasPermission(context, permission)) {
    const error = new Error('Insufficient permission for BI/KPI operation.');
    error.status = 403;
    error.code = 'PERMISSION_DENIED';
    throw error;
  }
}

function numeric(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function requireNumber(value, label, trace) {
  const number = numeric(value);
  if (number == null) {
    const error = new Error(`${label} is missing or not numeric.`);
    error.status = 400;
    error.code = 'KPI_INPUT_MISSING';
    error.trace = trace;
    throw error;
  }
  return number;
}

function inputValue(inputs, name) {
  if (!name) return null;
  const direct = inputs[name];
  if (direct !== undefined) return direct;
  return inputs[String(name).toLowerCase()];
}

function evaluateNode(node, inputs, trace) {
  const formula = toJson(node, {});
  const op = cleanText(formula.op || formula.type, 50);
  if (!ALLOWED_FORMULA_OPERATIONS.has(op)) {
    const error = new Error(`Unsupported KPI formula operation: ${op || 'missing'}.`);
    error.status = 400;
    error.code = 'UNSUPPORTED_FORMULA_OPERATION';
    throw error;
  }

  if (op === 'input') {
    const name = cleanText(formula.name || formula.key, 120);
    const value = requireNumber(inputValue(inputs, name), `Input ${name}`, trace);
    trace.steps.push({ op, name, value });
    return value;
  }
  if (op === 'constant') {
    const value = requireNumber(formula.value, 'Constant value', trace);
    trace.steps.push({ op, value });
    return value;
  }

  const values = Array.isArray(formula.values)
    ? formula.values.map((child) => evaluateNode(child, inputs, trace))
    : [];

  let result;
  if (op === 'sum') result = values.reduce((total, value) => total + value, 0);
  if (op === 'average') result = values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
  if (op === 'min') result = Math.min(...values);
  if (op === 'max') result = Math.max(...values);
  if (op === 'multiply') result = values.reduce((total, value) => total * value, values.length ? 1 : 0);
  if (op === 'subtract') {
    const left = evaluateNode(formula.left, inputs, trace);
    const right = evaluateNode(formula.right, inputs, trace);
    result = left - right;
  }
  if (op === 'divide' || op === 'ratio' || op === 'percentage') {
    const numerator = evaluateNode(formula.numerator, inputs, trace);
    const denominator = evaluateNode(formula.denominator, inputs, trace);
    if (denominator === 0) {
      if (formula.onZero === 'zero') result = 0;
      else {
        const error = new Error('KPI formula attempted division by zero.');
        error.status = 400;
        error.code = 'DIVISION_BY_ZERO';
        throw error;
      }
    } else {
      result = numerator / denominator;
      if (op === 'percentage') result *= 100;
    }
  }
  if (op === 'weighted_score') {
    const items = Array.isArray(formula.items) ? formula.items : [];
    let totalWeight = 0;
    let weighted = 0;
    for (const item of items) {
      const weight = requireNumber(item.weight ?? 1, 'Weight', trace);
      const value = evaluateNode(item.value, inputs, trace);
      totalWeight += weight;
      weighted += value * weight;
    }
    result = totalWeight ? weighted / totalWeight : 0;
  }
  if (op === 'threshold_score') {
    const value = evaluateNode(formula.value, inputs, trace);
    const good = numeric(formula.good);
    const warning = numeric(formula.warning);
    const direction = formula.direction || 'higher_is_better';
    if (direction === 'lower_is_better') {
      result = good != null && value <= good ? 100 : warning != null && value <= warning ? 70 : 30;
    } else {
      result = good != null && value >= good ? 100 : warning != null && value >= warning ? 70 : 30;
    }
  }
  if (op === 'capped') {
    const value = evaluateNode(formula.value, inputs, trace);
    const min = numeric(formula.min);
    const max = numeric(formula.max);
    result = Math.min(max ?? value, Math.max(min ?? value, value));
  }
  if (op === 'conditional') {
    const left = evaluateNode(formula.left, inputs, trace);
    const right = evaluateNode(formula.right, inputs, trace);
    const comparison = formula.comparison || 'gte';
    const matched = comparison === 'gt' ? left > right
      : comparison === 'lte' ? left <= right
        : comparison === 'lt' ? left < right
          : comparison === 'eq' ? left === right
            : left >= right;
    result = evaluateNode(matched ? formula.then : formula.else, inputs, trace);
  }

  if (!Number.isFinite(result)) {
    const error = new Error('KPI formula produced a non-finite result.');
    error.status = 400;
    error.code = 'INVALID_FORMULA_RESULT';
    throw error;
  }
  trace.steps.push({ op, result });
  return result;
}

function applyRounding(value, rules = {}) {
  const decimals = Number.isInteger(rules.decimals) ? Math.min(Math.max(rules.decimals, 0), 6) : 2;
  const factor = 10 ** decimals;
  if (rules.mode === 'floor') return Math.floor(value * factor) / factor;
  if (rules.mode === 'ceil') return Math.ceil(value * factor) / factor;
  return Math.round(value * factor) / factor;
}

function evaluateThreshold(value, thresholds = {}, direction = 'higher_is_better') {
  const warning = numeric(thresholds.warning);
  const critical = numeric(thresholds.critical);
  const good = numeric(thresholds.good);
  if (value == null) return 'missing_data';
  if (direction === 'lower_is_better') {
    if (critical != null && value >= critical) return 'critical';
    if (warning != null && value >= warning) return 'warning';
    return 'good';
  }
  if (direction === 'target') {
    const target = good ?? numeric(thresholds.target);
    const tolerance = numeric(thresholds.tolerance) ?? 0;
    if (target == null) return 'unknown';
    return Math.abs(value - target) <= tolerance ? 'good' : 'warning';
  }
  if (critical != null && value <= critical) return 'critical';
  if (warning != null && value <= warning) return 'warning';
  return 'good';
}

function normalizeScore(value, thresholds = {}, direction = 'higher_is_better') {
  const target = numeric(thresholds.good ?? thresholds.target);
  if (value == null || target == null || target === 0) return null;
  const score = direction === 'lower_is_better'
    ? (target / Math.max(value, 0.000001)) * 100
    : (value / target) * 100;
  return applyRounding(Math.min(150, Math.max(0, score)), { decimals: 2 });
}

function evaluateFormula(formulaVersion, inputs = {}) {
  const expression = toJson(formulaVersion.expression, {});
  const roundingRules = toJson(formulaVersion.roundingRules || formulaVersion.rounding_rules, {});
  const thresholds = toJson(formulaVersion.thresholds, {});
  const trace = {
    formulaVersionId: formulaVersion.id || null,
    formulaVersion: formulaVersion.version || null,
    formulaType: formulaVersion.formulaType || formulaVersion.formula_type || 'structured',
    steps: [],
    missingDataBehavior: formulaVersion.missingDataBehavior || 'fail_explicitly'
  };
  const rawValue = evaluateNode(expression, inputs, trace);
  const calculatedValue = applyRounding(rawValue, roundingRules);
  return { calculatedValue, trace };
}

function definitionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category,
    unit: row.unit,
    direction: row.direction,
    status: row.status,
    ownerPermission: row.owner_permission,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

function formulaFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    kpiDefinitionId: row.kpi_definition_id,
    version: row.version,
    formulaType: row.formula_type,
    expression: row.expression,
    inputDefinitions: row.input_definitions,
    weighting: row.weighting,
    thresholds: row.thresholds,
    roundingRules: row.rounding_rules,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    status: row.status,
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
    kpiDefinitionId: row.kpi_definition_id,
    formulaVersionId: row.formula_version_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    rawInputs: row.raw_inputs,
    calculatedValue: row.calculated_value == null ? null : Number(row.calculated_value),
    normalizedScore: row.normalized_score == null ? null : Number(row.normalized_score),
    thresholdStatus: row.threshold_status,
    explanationTrace: row.explanation_trace,
    sourceFreshness: row.source_freshness,
    calculatedAt: row.calculated_at,
    immutableSnapshotId: row.immutable_snapshot_id,
    calculationRunKey: row.calculation_run_key,
    initiatedBy: row.initiated_by
  };
}

function dashboardFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    audiencePermission: row.audience_permission,
    status: row.status,
    layoutConfig: row.layout_config,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function widgetFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    dashboardId: row.dashboard_id,
    kpiDefinitionId: row.kpi_definition_id,
    visualizationType: row.visualization_type,
    displayOrder: row.display_order,
    filters: row.filters,
    drillDownTarget: row.drill_down_target,
    thresholdAlertSettings: row.threshold_alert_settings,
    createdAt: row.created_at
  };
}

async function createKpiDefinition(context, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.KPI_MANAGE);
  const result = await postgres.query(`
    INSERT INTO kpi_definitions (
      organization_id, key, name, description, category, unit, direction, status, owner_permission, created_by
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING *
  `, [
    organizationId,
    normalizeKey(input.key),
    cleanText(input.name, 180) || normalizeKey(input.key),
    cleanNullableText(input.description, 1000),
    cleanText(input.category || 'operations', 120),
    cleanText(input.unit || 'count', 60),
    ['higher_is_better', 'lower_is_better', 'target'].includes(input.direction) ? input.direction : 'higher_is_better',
    ['draft', 'active', 'inactive', 'archived'].includes(input.status) ? input.status : 'draft',
    cleanText(input.ownerPermission || rbac.PERMISSIONS.KPI_MANAGE, 120),
    context.actorId || null
  ]);
  return definitionFromRow(result.rows[0]);
}

async function listKpiDefinitions(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.KPI_VIEW);
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 100, 1), 250);
  const values = [organizationId, limit];
  const where = ['organization_id = $1', 'deleted_at IS NULL'];
  if (filters.status) {
    values.push(cleanText(filters.status, 40));
    where.push(`status = $${values.length}`);
  }
  const result = await postgres.query(`
    SELECT * FROM kpi_definitions
    WHERE ${where.join(' AND ')}
    ORDER BY category, name
    LIMIT $2
  `, values);
  return result.rows.map(definitionFromRow);
}

async function getKpiDefinition(context, id) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.KPI_VIEW);
  const result = await postgres.query(
    'SELECT * FROM kpi_definitions WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
    [cleanText(id, 120), organizationId]
  );
  if (!result.rows[0]) {
    const error = new Error('KPI definition not found.');
    error.status = 404;
    error.code = 'KPI_NOT_FOUND';
    throw error;
  }
  return definitionFromRow(result.rows[0]);
}

async function createFormulaVersion(context, kpiDefinitionId, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.KPI_FORMULA_MANAGE);
  await getKpiDefinition(context, kpiDefinitionId);
  const latest = await postgres.query(
    'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM kpi_formula_versions WHERE kpi_definition_id = $1',
    [cleanText(kpiDefinitionId, 120)]
  );
  const version = Number.parseInt(input.version, 10) || Number(latest.rows[0]?.next_version || 1);
  const status = ['draft', 'active', 'retired'].includes(input.status) ? input.status : 'draft';
  const approvedBy = status === 'active' ? context.actorId : cleanNullableText(input.approvedBy, 120);
  const result = await postgres.query(`
    INSERT INTO kpi_formula_versions (
      kpi_definition_id, version, formula_type, expression, input_definitions, weighting,
      thresholds, rounding_rules, effective_from, effective_to, status, created_by, approved_by
    )
    SELECT $1,$2,'structured',$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,
      COALESCE($8::timestamptz, NOW()), $9::timestamptz, $10, $11, $12
    WHERE EXISTS (SELECT 1 FROM kpi_definitions WHERE id = $1 AND organization_id = $13)
    RETURNING *
  `, [
    cleanText(kpiDefinitionId, 120),
    version,
    JSON.stringify(toJson(input.expression, {})),
    JSON.stringify(toJson(input.inputDefinitions || input.input_definitions, [])),
    JSON.stringify(toJson(input.weighting, {})),
    JSON.stringify(toJson(input.thresholds, {})),
    JSON.stringify(toJson(input.roundingRules || input.rounding_rules, { decimals: 2 })),
    input.effectiveFrom || input.effective_from || null,
    input.effectiveTo || input.effective_to || null,
    status,
    context.actorId || null,
    approvedBy,
    organizationId
  ]);
  if (!result.rows[0]) {
    const error = new Error('KPI definition not found for this Organization.');
    error.status = 404;
    error.code = 'KPI_NOT_FOUND';
    throw error;
  }
  return formulaFromRow(result.rows[0]);
}

async function listFormulaVersions(context, kpiDefinitionId) {
  assertDatabaseReady();
  await getKpiDefinition(context, kpiDefinitionId);
  const result = await postgres.query(
    'SELECT * FROM kpi_formula_versions WHERE kpi_definition_id = $1 ORDER BY version DESC',
    [cleanText(kpiDefinitionId, 120)]
  );
  return result.rows.map(formulaFromRow);
}

async function activeFormulaForDefinition(kpiDefinitionId, at = new Date()) {
  const result = await postgres.query(`
    SELECT * FROM kpi_formula_versions
    WHERE kpi_definition_id = $1
      AND status = 'active'
      AND effective_from <= $2
      AND (effective_to IS NULL OR effective_to >= $2)
    ORDER BY version DESC
    LIMIT 1
  `, [cleanText(kpiDefinitionId, 120), at]);
  if (!result.rows[0]) {
    const error = new Error('No active KPI formula version is available for this period.');
    error.status = 400;
    error.code = 'ACTIVE_FORMULA_REQUIRED';
    throw error;
  }
  return formulaFromRow(result.rows[0]);
}

function buildRunKey(organizationId, kpiDefinitionId, subjectType, subjectId, periodStart, periodEnd, provided) {
  return cleanText(provided, 240)
    || `${organizationId}:${kpiDefinitionId}:${subjectType}:${subjectId}:${new Date(periodStart).toISOString()}:${new Date(periodEnd).toISOString()}`;
}

async function calculateKpi(context, kpiDefinitionId, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.KPI_CALCULATE);
  const definition = await getKpiDefinition(context, kpiDefinitionId);
  const periodStart = new Date(input.periodStart || input.period_start || Date.now() - 24 * 60 * 60 * 1000);
  const periodEnd = new Date(input.periodEnd || input.period_end || Date.now());
  if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) || periodEnd < periodStart) {
    const error = new Error('Valid KPI period start and end are required.');
    error.status = 400;
    error.code = 'INVALID_KPI_PERIOD';
    throw error;
  }
  const subjectType = cleanText(input.subjectType || input.subject_type || 'organization', 80);
  const subjectId = cleanText(input.subjectId || input.subject_id || organizationId, 180);
  const rawInputs = toJson(input.inputs || input.rawInputs || input.raw_inputs, {});
  const formula = input.formulaVersionId
    ? formulaFromRow((await postgres.query(`
        SELECT fv.* FROM kpi_formula_versions fv
        JOIN kpi_definitions kd ON kd.id = fv.kpi_definition_id
        WHERE fv.id = $1 AND kd.organization_id = $2 AND kd.id = $3
      `, [cleanText(input.formulaVersionId, 120), organizationId, definition.id])).rows[0])
    : await activeFormulaForDefinition(definition.id, periodEnd);
  if (!formula) {
    const error = new Error('Formula version not found for this Organization.');
    error.status = 404;
    error.code = 'FORMULA_NOT_FOUND';
    throw error;
  }
  const output = evaluateFormula(formula, rawInputs);
  const thresholds = toJson(formula.thresholds, {});
  const thresholdStatus = evaluateThreshold(output.calculatedValue, thresholds, definition.direction);
  const normalizedScore = normalizeScore(output.calculatedValue, thresholds, definition.direction);
  const sourceFreshness = {
    status: input.sourceFreshnessStatus || 'provided_inputs',
    capturedAt: input.sourceCapturedAt || new Date().toISOString(),
    missingInputs: []
  };
  const runKey = buildRunKey(organizationId, definition.id, subjectType, subjectId, periodStart, periodEnd, input.calculationRunKey || input.runKey);

  const snapshot = await postgres.withTransaction(async (client) => {
    const job = await client.query(`
      INSERT INTO kpi_calculation_jobs (
        organization_id, kpi_definition_id, schedule_type, run_key, status, formula_version_id,
        period_start, period_end, requested_by, started_at, completed_at
      )
      VALUES ($1,$2,$3,$4,'completed',$5,$6,$7,$8,NOW(),NOW())
      ON CONFLICT (organization_id, run_key) DO UPDATE SET
        status = 'completed',
        completed_at = NOW()
      RETURNING *
    `, [
      organizationId,
      definition.id,
      ['daily', 'weekly', 'monthly', 'on_demand'].includes(input.scheduleType) ? input.scheduleType : 'on_demand',
      runKey,
      formula.id,
      periodStart,
      periodEnd,
      context.actorId || null
    ]);
    const snapshotResult = await client.query(`
      INSERT INTO kpi_snapshots (
        organization_id, kpi_definition_id, formula_version_id, subject_type, subject_id,
        period_start, period_end, raw_inputs, calculated_value, normalized_score,
        threshold_status, explanation_trace, source_freshness, calculation_run_key, initiated_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15)
      RETURNING *
    `, [
      organizationId,
      definition.id,
      formula.id,
      subjectType,
      subjectId,
      periodStart,
      periodEnd,
      JSON.stringify(rawInputs),
      output.calculatedValue,
      normalizedScore,
      thresholdStatus,
      JSON.stringify({
        ...output.trace,
        calculation: `${definition.key} v${formula.version}`,
        humanExplanation: `Calculated ${definition.name} using formula version ${formula.version}.`
      }),
      JSON.stringify(sourceFreshness),
      runKey,
      context.actorId || null
    ]);
    return snapshotResult.rows[0];
  });

  await createAlertIfNeeded(context, definition, snapshotFromRow(snapshot)).catch(() => {});
  return snapshotFromRow(snapshot);
}

async function listSnapshots(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.KPI_SNAPSHOT_VIEW);
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 100, 1), 500);
  const values = [organizationId, limit];
  const where = ['organization_id = $1'];
  if (filters.kpiDefinitionId || filters.kpi_definition_id) {
    values.push(cleanText(filters.kpiDefinitionId || filters.kpi_definition_id, 120));
    where.push(`kpi_definition_id = $${values.length}`);
  }
  if (filters.subjectType || filters.subject_type) {
    values.push(cleanText(filters.subjectType || filters.subject_type, 80));
    where.push(`subject_type = $${values.length}`);
  }
  if (filters.subjectId || filters.subject_id) {
    values.push(cleanText(filters.subjectId || filters.subject_id, 180));
    where.push(`subject_id = $${values.length}`);
  }
  const result = await postgres.query(`
    SELECT * FROM kpi_snapshots
    WHERE ${where.join(' AND ')}
    ORDER BY calculated_at DESC
    LIMIT $2
  `, values);
  return result.rows.map(snapshotFromRow);
}

async function getSnapshot(context, id) {
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.KPI_SNAPSHOT_VIEW);
  const result = await postgres.query(
    'SELECT * FROM kpi_snapshots WHERE id = $1 AND organization_id = $2',
    [cleanText(id, 120), organizationId]
  );
  if (!result.rows[0]) {
    const error = new Error('KPI snapshot not found.');
    error.status = 404;
    error.code = 'SNAPSHOT_NOT_FOUND';
    throw error;
  }
  return snapshotFromRow(result.rows[0]);
}

async function createDashboard(context, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.DASHBOARD_MANAGE);
  const result = await postgres.query(`
    INSERT INTO bi_dashboards (organization_id, name, description, audience_permission, status, layout_config, created_by)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
    RETURNING *
  `, [
    organizationId,
    cleanText(input.name, 180) || 'Operational KPI Dashboard',
    cleanNullableText(input.description, 1000),
    cleanText(input.audiencePermission || rbac.PERMISSIONS.DASHBOARD_VIEW, 120),
    ['draft', 'active', 'archived'].includes(input.status) ? input.status : 'active',
    JSON.stringify(toJson(input.layoutConfig || input.layout_config, {})),
    context.actorId || null
  ]);
  return dashboardFromRow(result.rows[0]);
}

async function listDashboards(context, filters = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.DASHBOARD_VIEW);
  const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 50, 1), 100);
  const result = await postgres.query(
    `SELECT * FROM bi_dashboards WHERE organization_id = $1 AND status <> 'archived' ORDER BY created_at DESC LIMIT $2`,
    [organizationId, limit]
  );
  return result.rows
    .map(dashboardFromRow)
    .filter((dashboard) => rbac.hasPermission(context, dashboard.audiencePermission));
}

async function getDashboard(context, id) {
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.DASHBOARD_VIEW);
  const result = await postgres.query(
    'SELECT * FROM bi_dashboards WHERE id = $1 AND organization_id = $2',
    [cleanText(id, 120), organizationId]
  );
  const dashboard = dashboardFromRow(result.rows[0]);
  if (!dashboard || !rbac.hasPermission(context, dashboard.audiencePermission)) {
    const error = new Error('BI dashboard not found.');
    error.status = 404;
    error.code = 'DASHBOARD_NOT_FOUND';
    throw error;
  }
  const widgets = await postgres.query(
    'SELECT * FROM bi_dashboard_widgets WHERE dashboard_id = $1 ORDER BY display_order, created_at',
    [dashboard.id]
  );
  const latestSnapshots = await listSnapshots(context, { limit: 100 });
  return {
    ...dashboard,
    widgets: widgets.rows.map(widgetFromRow),
    latestSnapshots
  };
}

async function addDashboardWidget(context, dashboardId, input = {}) {
  await getDashboard(context, dashboardId);
  requirePermission(context, rbac.PERMISSIONS.DASHBOARD_MANAGE);
  if (input.kpiDefinitionId || input.kpi_definition_id) {
    await getKpiDefinition(context, input.kpiDefinitionId || input.kpi_definition_id);
  }
  const result = await postgres.query(`
    INSERT INTO bi_dashboard_widgets (
      dashboard_id, kpi_definition_id, visualization_type, display_order, filters, drill_down_target, threshold_alert_settings
    )
    VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)
    RETURNING *
  `, [
    cleanText(dashboardId, 120),
    cleanNullableText(input.kpiDefinitionId || input.kpi_definition_id, 120),
    cleanText(input.visualizationType || input.visualization_type || 'card', 80),
    Number.parseInt(input.displayOrder ?? input.display_order, 10) || 0,
    JSON.stringify(toJson(input.filters, {})),
    JSON.stringify(toJson(input.drillDownTarget || input.drill_down_target, {})),
    JSON.stringify(toJson(input.thresholdAlertSettings || input.threshold_alert_settings, {}))
  ]);
  return widgetFromRow(result.rows[0]);
}

async function createAlertRule(context, input = {}) {
  assertDatabaseReady();
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.KPI_ALERT_MANAGE);
  await getKpiDefinition(context, input.kpiDefinitionId || input.kpi_definition_id);
  const result = await postgres.query(`
    INSERT INTO kpi_alert_rules (
      organization_id, kpi_definition_id, comparison_rule, threshold, severity, target_permission, cooldown_minutes, status
    )
    VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8)
    RETURNING *
  `, [
    organizationId,
    cleanText(input.kpiDefinitionId || input.kpi_definition_id, 120),
    JSON.stringify(toJson(input.comparisonRule || input.comparison_rule, { op: 'threshold_status_in', values: ['warning', 'critical'] })),
    numeric(input.threshold),
    ['info', 'warning', 'critical'].includes(input.severity) ? input.severity : 'warning',
    cleanText(input.targetPermission || input.target_permission || rbac.PERMISSIONS.DASHBOARD_VIEW, 120),
    Math.min(Math.max(Number.parseInt(input.cooldownMinutes || input.cooldown_minutes, 10) || 1440, 0), 43200),
    ['active', 'inactive', 'archived'].includes(input.status) ? input.status : 'active'
  ]);
  return result.rows[0];
}

async function createAlertIfNeeded(context, definition, snapshot) {
  if (!['warning', 'critical', 'missing_data', 'stale_data', 'calculation_failed'].includes(snapshot.thresholdStatus)) return null;
  const ruleResult = await postgres.query(`
    SELECT * FROM kpi_alert_rules
    WHERE organization_id = $1 AND kpi_definition_id = $2 AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `, [snapshot.organizationId, definition.id]);
  const rule = ruleResult.rows[0];
  const eventKey = `${snapshot.organizationId}:${definition.id}:${snapshot.subjectType}:${snapshot.subjectId}:${snapshot.thresholdStatus}:${snapshot.periodEnd}`;
  const result = await postgres.query(`
    INSERT INTO kpi_alert_events (
      organization_id, alert_rule_id, kpi_snapshot_id, event_key, severity, status, message, target_permission
    )
    VALUES ($1,$2,$3,$4,$5,'open',$6,$7)
    ON CONFLICT (organization_id, event_key) DO NOTHING
    RETURNING *
  `, [
    snapshot.organizationId,
    rule?.id || null,
    snapshot.id,
    eventKey,
    snapshot.thresholdStatus === 'critical' ? 'critical' : 'warning',
    `${definition.name} is ${snapshot.thresholdStatus} for ${snapshot.subjectType} ${snapshot.subjectId}.`,
    rule?.target_permission || rbac.PERMISSIONS.DASHBOARD_VIEW
  ]);
  return result.rows[0] || null;
}

async function listAlerts(context, filters = {}) {
  const organizationId = requireOrganizationContext(context);
  requirePermission(context, rbac.PERMISSIONS.KPI_VIEW);
  const status = cleanText(filters.status || 'open', 40);
  const result = await postgres.query(`
    SELECT * FROM kpi_alert_events
    WHERE organization_id = $1 AND ($2 = '' OR status = $2)
    ORDER BY created_at DESC
    LIMIT 100
  `, [organizationId, status]);
  return result.rows;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function exportSnapshotsCsv(context, filters = {}) {
  requirePermission(context, rbac.PERMISSIONS.DASHBOARD_EXPORT);
  const snapshots = await listSnapshots(context, { ...filters, limit: Math.min(Number.parseInt(filters.limit, 10) || 500, 1000) });
  const rows = [
    ['snapshot_id', 'kpi_definition_id', 'formula_version_id', 'subject_type', 'subject_id', 'period_start', 'period_end', 'calculated_value', 'normalized_score', 'threshold_status', 'calculated_at']
  ];
  for (const snapshot of snapshots) {
    rows.push([
      snapshot.id,
      snapshot.kpiDefinitionId,
      snapshot.formulaVersionId,
      snapshot.subjectType,
      snapshot.subjectId,
      snapshot.periodStart,
      snapshot.periodEnd,
      snapshot.calculatedValue,
      snapshot.normalizedScore,
      snapshot.thresholdStatus,
      snapshot.calculatedAt
    ]);
  }
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

module.exports = {
  KPI_FAMILIES,
  ALLOWED_FORMULA_OPERATIONS,
  addDashboardWidget,
  calculateKpi,
  createAlertRule,
  createDashboard,
  createFormulaVersion,
  createKpiDefinition,
  evaluateFormula,
  exportSnapshotsCsv,
  getDashboard,
  getKpiDefinition,
  getSnapshot,
  listAlerts,
  listDashboards,
  listFormulaVersions,
  listKpiDefinitions,
  listSnapshots
};
