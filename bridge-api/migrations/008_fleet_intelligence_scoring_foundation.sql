CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO role_permissions (role, permission)
VALUES
  ('PLATFORM_ADMIN', 'fleet_score.view'),
  ('PLATFORM_ADMIN', 'fleet_score.manage'),
  ('PLATFORM_ADMIN', 'fleet_score.calculate'),
  ('PLATFORM_ADMIN', 'fleet_score.benchmark'),
  ('PLATFORM_ADMIN', 'platform.fleet_score.support'),
  ('ORGANIZATION_ADMIN', 'fleet_score.view'),
  ('ORGANIZATION_ADMIN', 'fleet_score.manage'),
  ('ORGANIZATION_ADMIN', 'fleet_score.calculate'),
  ('ORGANIZATION_ADMIN', 'fleet_score.benchmark'),
  ('SUPERVISOR', 'fleet_score.view'),
  ('SUPERVISOR', 'fleet_score.calculate'),
  ('SUPERVISOR', 'fleet_score.benchmark'),
  ('DRIVER', 'fleet_score.view'),
  ('WAREHOUSE_EMPLOYEE', 'fleet_score.view')
ON CONFLICT (role, permission) DO NOTHING;

CREATE TABLE IF NOT EXISTS fleet_score_models (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  score_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  subject_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT fleet_score_models_subject_type_check CHECK (subject_type IN (
    'driver', 'vehicle', 'route', 'customer', 'supervisor', 'route_dispatch_function',
    'depot_operations', 'regional_operations', 'organization', 'fleet'
  )),
  CONSTRAINT fleet_score_models_status_check CHECK (status IN ('draft', 'active', 'inactive', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS fleet_score_models_org_key_active_idx
  ON fleet_score_models(organization_id, score_key)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS fleet_score_models_org_status_idx
  ON fleet_score_models(organization_id, status, subject_type);

CREATE TABLE IF NOT EXISTS fleet_score_model_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  score_model_id TEXT NOT NULL REFERENCES fleet_score_models(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL,
  scoring_method TEXT NOT NULL DEFAULT 'weighted_components',
  component_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  formula_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fleet_score_model_versions_status_check CHECK (status IN ('draft', 'active', 'retired')),
  CONSTRAINT fleet_score_model_versions_method_check CHECK (scoring_method IN ('weighted_components'))
);

CREATE UNIQUE INDEX IF NOT EXISTS fleet_score_model_versions_model_version_idx
  ON fleet_score_model_versions(score_model_id, version);
CREATE INDEX IF NOT EXISTS fleet_score_model_versions_active_idx
  ON fleet_score_model_versions(score_model_id, status, effective_from DESC);

CREATE OR REPLACE FUNCTION prevent_active_fleet_score_model_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RAISE EXCEPTION 'Active fleet score model versions are immutable; create a new version.';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    RAISE EXCEPTION 'Active fleet score model versions cannot be deleted.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fleet_score_model_versions_immutable_active_trg ON fleet_score_model_versions;
CREATE TRIGGER fleet_score_model_versions_immutable_active_trg
  BEFORE UPDATE OR DELETE ON fleet_score_model_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_active_fleet_score_model_version_mutation();

CREATE TABLE IF NOT EXISTS fleet_score_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  score_model_id TEXT NOT NULL REFERENCES fleet_score_models(id) ON DELETE RESTRICT,
  score_model_version_id TEXT NOT NULL REFERENCES fleet_score_model_versions(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  score_value NUMERIC(8,4) NOT NULL,
  score_band TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculation_run_key TEXT,
  immutable_snapshot_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  calculated_by TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fleet_score_snapshots_period_check CHECK (period_end >= period_start),
  CONSTRAINT fleet_score_snapshots_score_check CHECK (score_value >= 0 AND score_value <= 100),
  CONSTRAINT fleet_score_snapshots_confidence_check CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT fleet_score_snapshots_band_check CHECK (score_band IN ('excellent', 'good', 'watch', 'risk', 'critical'))
);

CREATE UNIQUE INDEX IF NOT EXISTS fleet_score_snapshots_run_key_idx
  ON fleet_score_snapshots(organization_id, calculation_run_key)
  WHERE calculation_run_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS fleet_score_snapshots_org_subject_idx
  ON fleet_score_snapshots(organization_id, subject_type, subject_id, period_end DESC);
CREATE INDEX IF NOT EXISTS fleet_score_snapshots_model_idx
  ON fleet_score_snapshots(organization_id, score_model_id, period_end DESC);
CREATE INDEX IF NOT EXISTS fleet_score_snapshots_lineage_idx
  ON fleet_score_snapshots USING GIN(lineage);

CREATE OR REPLACE FUNCTION prevent_fleet_score_snapshot_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Fleet score snapshots are immutable; create a new snapshot.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fleet_score_snapshots_immutable_trg ON fleet_score_snapshots;
CREATE TRIGGER fleet_score_snapshots_immutable_trg
  BEFORE UPDATE OR DELETE ON fleet_score_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_fleet_score_snapshot_mutation();

CREATE TABLE IF NOT EXISTS fleet_score_component_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  score_snapshot_id TEXT NOT NULL REFERENCES fleet_score_snapshots(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  component_key TEXT NOT NULL,
  component_name TEXT NOT NULL,
  weight NUMERIC(8,4) NOT NULL,
  raw_value NUMERIC(12,4),
  normalized_score NUMERIC(8,4) NOT NULL,
  contribution NUMERIC(8,4) NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fleet_score_components_weight_check CHECK (weight >= 0),
  CONSTRAINT fleet_score_components_normalized_check CHECK (normalized_score >= 0 AND normalized_score <= 100)
);

CREATE INDEX IF NOT EXISTS fleet_score_components_snapshot_idx
  ON fleet_score_component_snapshots(score_snapshot_id, component_key);
CREATE INDEX IF NOT EXISTS fleet_score_components_org_component_idx
  ON fleet_score_component_snapshots(organization_id, component_key, created_at DESC);

CREATE TABLE IF NOT EXISTS fleet_score_benchmark_sets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  benchmark_scope TEXT NOT NULL DEFAULT 'organization_private',
  subject_type TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  aggregate_method TEXT NOT NULL DEFAULT 'median',
  population_size INTEGER NOT NULL DEFAULT 0,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  anonymization_status TEXT NOT NULL DEFAULT 'not_shared',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fleet_score_benchmark_scope_check CHECK (benchmark_scope IN ('organization_private', 'approved_anonymized_shared')),
  CONSTRAINT fleet_score_benchmark_method_check CHECK (aggregate_method IN ('average', 'median', 'percentile')),
  CONSTRAINT fleet_score_benchmark_anonymization_check CHECK (anonymization_status IN ('not_shared', 'pending_review', 'approved_anonymized'))
);

CREATE INDEX IF NOT EXISTS fleet_score_benchmark_sets_org_idx
  ON fleet_score_benchmark_sets(organization_id, subject_type, period_end DESC);
