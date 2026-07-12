CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO role_permissions (role, permission)
VALUES
  ('PLATFORM_ADMIN', 'kpi.view'),
  ('PLATFORM_ADMIN', 'kpi.manage'),
  ('PLATFORM_ADMIN', 'kpi.formula.manage'),
  ('PLATFORM_ADMIN', 'kpi.calculate'),
  ('PLATFORM_ADMIN', 'kpi.snapshot.view'),
  ('PLATFORM_ADMIN', 'dashboard.view'),
  ('PLATFORM_ADMIN', 'dashboard.manage'),
  ('PLATFORM_ADMIN', 'dashboard.export'),
  ('PLATFORM_ADMIN', 'kpi.alert.manage'),
  ('PLATFORM_ADMIN', 'platform.kpi.support'),
  ('ORGANIZATION_ADMIN', 'kpi.view'),
  ('ORGANIZATION_ADMIN', 'kpi.manage'),
  ('ORGANIZATION_ADMIN', 'kpi.formula.manage'),
  ('ORGANIZATION_ADMIN', 'kpi.calculate'),
  ('ORGANIZATION_ADMIN', 'kpi.snapshot.view'),
  ('ORGANIZATION_ADMIN', 'dashboard.view'),
  ('ORGANIZATION_ADMIN', 'dashboard.manage'),
  ('ORGANIZATION_ADMIN', 'dashboard.export'),
  ('ORGANIZATION_ADMIN', 'kpi.alert.manage'),
  ('SUPERVISOR', 'kpi.view'),
  ('SUPERVISOR', 'kpi.calculate'),
  ('SUPERVISOR', 'kpi.snapshot.view'),
  ('SUPERVISOR', 'dashboard.view'),
  ('SUPERVISOR', 'dashboard.export'),
  ('DRIVER', 'kpi.view'),
  ('DRIVER', 'kpi.snapshot.view'),
  ('WAREHOUSE_EMPLOYEE', 'kpi.view')
ON CONFLICT (role, permission) DO NOTHING;

CREATE TABLE IF NOT EXISTS kpi_definitions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'operations',
  unit TEXT NOT NULL DEFAULT 'count',
  direction TEXT NOT NULL DEFAULT 'higher_is_better',
  status TEXT NOT NULL DEFAULT 'draft',
  owner_permission TEXT NOT NULL DEFAULT 'kpi.manage',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT kpi_definitions_direction_check CHECK (direction IN ('higher_is_better', 'lower_is_better', 'target')),
  CONSTRAINT kpi_definitions_status_check CHECK (status IN ('draft', 'active', 'inactive', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS kpi_definitions_org_key_active_idx
  ON kpi_definitions(organization_id, key)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS kpi_definitions_org_status_idx
  ON kpi_definitions(organization_id, status, category);

CREATE TABLE IF NOT EXISTS kpi_formula_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kpi_definition_id TEXT NOT NULL REFERENCES kpi_definitions(id),
  version INTEGER NOT NULL,
  formula_type TEXT NOT NULL DEFAULT 'structured',
  expression JSONB NOT NULL DEFAULT '{}'::jsonb,
  input_definitions JSONB NOT NULL DEFAULT '[]'::jsonb,
  weighting JSONB NOT NULL DEFAULT '{}'::jsonb,
  thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  rounding_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kpi_formula_versions_status_check CHECK (status IN ('draft', 'active', 'retired')),
  CONSTRAINT kpi_formula_versions_type_check CHECK (formula_type IN ('structured'))
);

CREATE UNIQUE INDEX IF NOT EXISTS kpi_formula_versions_definition_version_idx
  ON kpi_formula_versions(kpi_definition_id, version);
CREATE INDEX IF NOT EXISTS kpi_formula_versions_active_idx
  ON kpi_formula_versions(kpi_definition_id, status, effective_from DESC);

CREATE OR REPLACE FUNCTION prevent_active_formula_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RAISE EXCEPTION 'Active KPI formula versions are immutable; create a new version.';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    RAISE EXCEPTION 'Active KPI formula versions cannot be deleted.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kpi_formula_versions_immutable_active_trg ON kpi_formula_versions;
CREATE TRIGGER kpi_formula_versions_immutable_active_trg
  BEFORE UPDATE OR DELETE ON kpi_formula_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_active_formula_version_mutation();

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  kpi_definition_id TEXT NOT NULL REFERENCES kpi_definitions(id),
  formula_version_id TEXT NOT NULL REFERENCES kpi_formula_versions(id),
  subject_type TEXT NOT NULL DEFAULT 'organization',
  subject_id TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  raw_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_value NUMERIC(18,6),
  normalized_score NUMERIC(18,6),
  threshold_status TEXT NOT NULL DEFAULT 'unknown',
  explanation_trace JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_freshness JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  immutable_snapshot_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  calculation_run_key TEXT,
  initiated_by TEXT,
  CONSTRAINT kpi_snapshots_period_check CHECK (period_end >= period_start),
  CONSTRAINT kpi_snapshots_threshold_status_check CHECK (threshold_status IN ('unknown', 'good', 'warning', 'critical', 'missing_data', 'stale_data', 'calculation_failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS kpi_snapshots_run_key_idx
  ON kpi_snapshots(organization_id, calculation_run_key)
  WHERE calculation_run_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS kpi_snapshots_org_kpi_period_idx
  ON kpi_snapshots(organization_id, kpi_definition_id, period_end DESC);
CREATE INDEX IF NOT EXISTS kpi_snapshots_subject_idx
  ON kpi_snapshots(organization_id, subject_type, subject_id, period_end DESC);

CREATE OR REPLACE FUNCTION prevent_kpi_snapshot_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'KPI snapshots are immutable; create a new snapshot.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kpi_snapshots_immutable_update_trg ON kpi_snapshots;
CREATE TRIGGER kpi_snapshots_immutable_update_trg
  BEFORE UPDATE OR DELETE ON kpi_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_kpi_snapshot_mutation();

CREATE TABLE IF NOT EXISTS bi_dashboards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  audience_permission TEXT NOT NULL DEFAULT 'dashboard.view',
  status TEXT NOT NULL DEFAULT 'active',
  layout_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bi_dashboards_status_check CHECK (status IN ('draft', 'active', 'archived'))
);

CREATE INDEX IF NOT EXISTS bi_dashboards_org_status_idx
  ON bi_dashboards(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS bi_dashboard_widgets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dashboard_id TEXT NOT NULL REFERENCES bi_dashboards(id) ON DELETE CASCADE,
  kpi_definition_id TEXT REFERENCES kpi_definitions(id),
  visualization_type TEXT NOT NULL DEFAULT 'card',
  display_order INTEGER NOT NULL DEFAULT 0,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  drill_down_target JSONB NOT NULL DEFAULT '{}'::jsonb,
  threshold_alert_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bi_dashboard_widgets_dashboard_idx
  ON bi_dashboard_widgets(dashboard_id, display_order);

CREATE TABLE IF NOT EXISTS kpi_alert_rules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  kpi_definition_id TEXT NOT NULL REFERENCES kpi_definitions(id),
  comparison_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  threshold NUMERIC(18,6),
  severity TEXT NOT NULL DEFAULT 'warning',
  target_permission TEXT NOT NULL DEFAULT 'dashboard.view',
  cooldown_minutes INTEGER NOT NULL DEFAULT 1440,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kpi_alert_rules_severity_check CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT kpi_alert_rules_status_check CHECK (status IN ('active', 'inactive', 'archived'))
);

CREATE INDEX IF NOT EXISTS kpi_alert_rules_org_status_idx
  ON kpi_alert_rules(organization_id, status, severity);

CREATE TABLE IF NOT EXISTS kpi_alert_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  alert_rule_id TEXT REFERENCES kpi_alert_rules(id),
  kpi_snapshot_id TEXT REFERENCES kpi_snapshots(id),
  event_key TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  status TEXT NOT NULL DEFAULT 'open',
  message TEXT NOT NULL,
  target_permission TEXT NOT NULL DEFAULT 'dashboard.view',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  CONSTRAINT kpi_alert_events_status_check CHECK (status IN ('open', 'acknowledged', 'resolved'))
);

CREATE UNIQUE INDEX IF NOT EXISTS kpi_alert_events_event_key_idx
  ON kpi_alert_events(organization_id, event_key);
CREATE INDEX IF NOT EXISTS kpi_alert_events_org_status_idx
  ON kpi_alert_events(organization_id, status, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS kpi_calculation_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  kpi_definition_id TEXT REFERENCES kpi_definitions(id),
  schedule_type TEXT NOT NULL DEFAULT 'on_demand',
  run_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  formula_version_id TEXT REFERENCES kpi_formula_versions(id),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  requested_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CONSTRAINT kpi_calculation_jobs_schedule_check CHECK (schedule_type IN ('daily', 'weekly', 'monthly', 'on_demand')),
  CONSTRAINT kpi_calculation_jobs_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS kpi_calculation_jobs_run_key_idx
  ON kpi_calculation_jobs(organization_id, run_key);
CREATE INDEX IF NOT EXISTS kpi_calculation_jobs_org_status_idx
  ON kpi_calculation_jobs(organization_id, status, created_at DESC);
