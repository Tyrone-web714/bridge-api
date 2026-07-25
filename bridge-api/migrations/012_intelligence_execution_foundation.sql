CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS intelligence_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  request_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  actor_type TEXT,
  actor_id TEXT,
  actor_role TEXT,
  feature TEXT NOT NULL,
  capability TEXT NOT NULL,
  capability_version TEXT,
  task_type TEXT NOT NULL,
  execution_mode TEXT NOT NULL,
  input_classification TEXT NOT NULL,
  data_sensitivity TEXT NOT NULL,
  safety_classification TEXT NOT NULL,
  requested_output_format TEXT,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received',
  policy_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT intelligence_requests_status_check CHECK (status IN ('received', 'rejected', 'planned', 'running', 'completed', 'failed', 'human_review_required')),
  CONSTRAINT intelligence_requests_mode_check CHECK (execution_mode IN ('SYNCHRONOUS', 'BACKGROUND', 'BATCH', 'PLATFORM_ADMIN'))
);

CREATE UNIQUE INDEX IF NOT EXISTS intelligence_requests_org_request_idx
  ON intelligence_requests(organization_id, request_id);
CREATE UNIQUE INDEX IF NOT EXISTS intelligence_requests_org_idempotency_idx
  ON intelligence_requests(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS intelligence_requests_org_created_idx
  ON intelligence_requests(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_requests_capability_idx
  ON intelligence_requests(organization_id, capability, created_at DESC);

CREATE TABLE IF NOT EXISTS intelligence_execution_attempts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  request_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  execution_strategy TEXT NOT NULL,
  provider TEXT,
  model_identifier TEXT,
  model_class TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  latency_ms INTEGER,
  estimated_cost_usd NUMERIC(12,6),
  actual_cost_usd NUMERIC(12,6),
  escalation_reason TEXT,
  fallback_reason TEXT,
  error_code TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT intelligence_attempts_status_check CHECK (status IN ('planned', 'running', 'succeeded', 'failed', 'timeout', 'skipped')),
  CONSTRAINT intelligence_attempts_number_check CHECK (attempt_number >= 1)
);

CREATE INDEX IF NOT EXISTS intelligence_attempts_org_request_idx
  ON intelligence_execution_attempts(organization_id, request_id, attempt_number);
CREATE INDEX IF NOT EXISTS intelligence_attempts_strategy_idx
  ON intelligence_execution_attempts(organization_id, execution_strategy, started_at DESC);

CREATE TABLE IF NOT EXISTS intelligence_usage_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  request_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  execution_strategy TEXT NOT NULL,
  provider TEXT,
  model_class TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  image_units INTEGER,
  audio_seconds NUMERIC(12,3),
  tool_calls INTEGER,
  cache_status TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  escalation_count INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12,6),
  actual_cost_usd NUMERIC(12,6),
  cost_status TEXT NOT NULL DEFAULT 'unknown',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT intelligence_usage_cost_status_check CHECK (cost_status IN ('known', 'unknown', 'not_applicable'))
);

CREATE INDEX IF NOT EXISTS intelligence_usage_org_capability_idx
  ON intelligence_usage_records(organization_id, capability, recorded_at DESC);
CREATE INDEX IF NOT EXISTS intelligence_usage_org_request_idx
  ON intelligence_usage_records(organization_id, request_id);

CREATE TABLE IF NOT EXISTS intelligence_policy_versions (
  id TEXT PRIMARY KEY,
  policy_scope TEXT NOT NULL,
  organization_id TEXT REFERENCES organizations(id),
  status TEXT NOT NULL DEFAULT 'active',
  policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  CONSTRAINT intelligence_policy_scope_check CHECK (policy_scope IN ('platform_default', 'organization')),
  CONSTRAINT intelligence_policy_status_check CHECK (status IN ('draft', 'active', 'deprecated'))
);

CREATE INDEX IF NOT EXISTS intelligence_policy_versions_org_idx
  ON intelligence_policy_versions(organization_id, status);

CREATE TABLE IF NOT EXISTS intelligence_prompt_versions (
  id TEXT PRIMARY KEY,
  capability TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  template_ref TEXT NOT NULL,
  output_schema_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  deprecated_at TIMESTAMPTZ,
  CONSTRAINT intelligence_prompt_status_check CHECK (status IN ('draft', 'approved', 'deprecated'))
);

CREATE UNIQUE INDEX IF NOT EXISTS intelligence_prompt_versions_capability_version_idx
  ON intelligence_prompt_versions(capability, version);