CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO role_permissions (role, permission)
VALUES
  ('PLATFORM_ADMIN', 'intelligence.view'),
  ('PLATFORM_ADMIN', 'intelligence.review'),
  ('PLATFORM_ADMIN', 'intelligence.manage'),
  ('PLATFORM_ADMIN', 'recommendation.view'),
  ('PLATFORM_ADMIN', 'recommendation.decide'),
  ('PLATFORM_ADMIN', 'outcome.record'),
  ('PLATFORM_ADMIN', 'platform.intelligence.support'),
  ('ORGANIZATION_ADMIN', 'intelligence.view'),
  ('ORGANIZATION_ADMIN', 'intelligence.review'),
  ('ORGANIZATION_ADMIN', 'intelligence.manage'),
  ('ORGANIZATION_ADMIN', 'recommendation.view'),
  ('ORGANIZATION_ADMIN', 'recommendation.decide'),
  ('ORGANIZATION_ADMIN', 'outcome.record'),
  ('SUPERVISOR', 'intelligence.view'),
  ('SUPERVISOR', 'intelligence.review'),
  ('SUPERVISOR', 'recommendation.view'),
  ('SUPERVISOR', 'recommendation.decide'),
  ('SUPERVISOR', 'outcome.record'),
  ('DRIVER', 'recommendation.view'),
  ('WAREHOUSE_EMPLOYEE', 'intelligence.view')
ON CONFLICT (role, permission) DO NOTHING;

CREATE TABLE IF NOT EXISTS logistics_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'operations',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  subject_type TEXT NOT NULL DEFAULT 'organization',
  subject_id TEXT NOT NULL,
  route_id TEXT,
  driver_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INTEGER NOT NULL DEFAULT 1,
  correlation_id TEXT,
  idempotency_key TEXT,
  status TEXT NOT NULL DEFAULT 'ingested',
  created_by TEXT,
  CONSTRAINT logistics_events_status_check CHECK (status IN ('ingested', 'processed', 'ignored')),
  CONSTRAINT logistics_events_schema_version_check CHECK (schema_version >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS logistics_events_org_idempotency_idx
  ON logistics_events(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS logistics_events_org_time_idx
  ON logistics_events(organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS logistics_events_subject_idx
  ON logistics_events(organization_id, subject_type, subject_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS logistics_events_type_idx
  ON logistics_events(organization_id, event_type, event_category, occurred_at DESC);
CREATE INDEX IF NOT EXISTS logistics_events_payload_idx
  ON logistics_events USING GIN(payload);

CREATE TABLE IF NOT EXISTS logistics_signals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  signal_type TEXT NOT NULL,
  subject_type TEXT NOT NULL DEFAULT 'organization',
  subject_id TEXT NOT NULL,
  value NUMERIC(18,6),
  severity TEXT NOT NULL DEFAULT 'info',
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  status TEXT NOT NULL DEFAULT 'active',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  calculation_version TEXT NOT NULL DEFAULT 'logistics-foundation-v1',
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  run_key TEXT,
  created_by TEXT,
  CONSTRAINT logistics_signals_severity_check CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  CONSTRAINT logistics_signals_status_check CHECK (status IN ('active', 'superseded', 'dismissed', 'expired')),
  CONSTRAINT logistics_signals_confidence_check CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS logistics_signals_org_run_key_idx
  ON logistics_signals(organization_id, run_key)
  WHERE run_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS logistics_signals_org_status_idx
  ON logistics_signals(organization_id, status, severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS logistics_signals_subject_idx
  ON logistics_signals(organization_id, subject_type, subject_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS logistics_signals_lineage_idx
  ON logistics_signals USING GIN(lineage);

CREATE TABLE IF NOT EXISTS logistics_findings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  finding_type TEXT NOT NULL,
  subject_type TEXT NOT NULL DEFAULT 'organization',
  subject_id TEXT NOT NULL,
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  status TEXT NOT NULL DEFAULT 'open',
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_signal_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  created_by TEXT,
  CONSTRAINT logistics_findings_severity_check CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  CONSTRAINT logistics_findings_status_check CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  CONSTRAINT logistics_findings_confidence_check CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS logistics_findings_org_run_key_idx
  ON logistics_findings(organization_id, run_key)
  WHERE run_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS logistics_findings_org_status_idx
  ON logistics_findings(organization_id, status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS logistics_findings_subject_idx
  ON logistics_findings(organization_id, subject_type, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS logistics_findings_evidence_idx
  ON logistics_findings USING GIN(evidence);

CREATE TABLE IF NOT EXISTS logistics_recommendations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  finding_id TEXT REFERENCES logistics_findings(id) ON DELETE RESTRICT,
  recommendation_type TEXT NOT NULL,
  subject_type TEXT NOT NULL DEFAULT 'organization',
  subject_id TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  rationale TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5000,
  status TEXT NOT NULL DEFAULT 'proposed',
  supporting_finding_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by TEXT,
  CONSTRAINT logistics_recommendations_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT logistics_recommendations_status_check CHECK (status IN ('proposed', 'accepted', 'rejected', 'deferred', 'expired', 'reviewed')),
  CONSTRAINT logistics_recommendations_confidence_check CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS logistics_recommendations_org_run_key_idx
  ON logistics_recommendations(organization_id, run_key)
  WHERE run_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS logistics_recommendations_org_status_idx
  ON logistics_recommendations(organization_id, status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS logistics_recommendations_subject_idx
  ON logistics_recommendations(organization_id, subject_type, subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS logistics_recommendations_lineage_idx
  ON logistics_recommendations USING GIN(lineage);

CREATE TABLE IF NOT EXISTS logistics_decisions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  recommendation_id TEXT NOT NULL REFERENCES logistics_recommendations(id) ON DELETE RESTRICT,
  decided_by TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  audit_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT logistics_decisions_decision_check CHECK (decision IN ('accepted', 'rejected', 'deferred', 'marked_reviewed'))
);

CREATE INDEX IF NOT EXISTS logistics_decisions_org_recommendation_idx
  ON logistics_decisions(organization_id, recommendation_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS logistics_decisions_actor_idx
  ON logistics_decisions(organization_id, decided_by, decided_at DESC);

CREATE TABLE IF NOT EXISTS logistics_outcomes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  recommendation_id TEXT REFERENCES logistics_recommendations(id) ON DELETE RESTRICT,
  decision_id TEXT REFERENCES logistics_decisions(id) ON DELETE RESTRICT,
  outcome_type TEXT NOT NULL,
  result TEXT NOT NULL,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effectiveness NUMERIC(5,4),
  notes TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_by TEXT,
  CONSTRAINT logistics_outcomes_effectiveness_check CHECK (effectiveness IS NULL OR (effectiveness >= 0 AND effectiveness <= 1))
);

CREATE INDEX IF NOT EXISTS logistics_outcomes_org_time_idx
  ON logistics_outcomes(organization_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS logistics_outcomes_recommendation_idx
  ON logistics_outcomes(organization_id, recommendation_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS logistics_outcomes_metrics_idx
  ON logistics_outcomes USING GIN(metrics);
