CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO role_permissions (role, permission)
VALUES
  ('PLATFORM_ADMIN', 'lifecycle.user.deactivate'),
  ('PLATFORM_ADMIN', 'lifecycle.user.reactivate'),
  ('PLATFORM_ADMIN', 'lifecycle.user.request_delete'),
  ('PLATFORM_ADMIN', 'lifecycle.user.review_delete'),
  ('PLATFORM_ADMIN', 'lifecycle.user.purge'),
  ('PLATFORM_ADMIN', 'lifecycle.organization.terminate'),
  ('PLATFORM_ADMIN', 'lifecycle.organization.review'),
  ('PLATFORM_ADMIN', 'lifecycle.organization.purge'),
  ('PLATFORM_ADMIN', 'lifecycle.export'),
  ('PLATFORM_ADMIN', 'lifecycle.legal_hold.manage'),
  ('PLATFORM_ADMIN', 'lifecycle.dsr.manage'),
  ('PLATFORM_ADMIN', 'platform.lifecycle.support'),
  ('ORGANIZATION_ADMIN', 'lifecycle.user.deactivate'),
  ('ORGANIZATION_ADMIN', 'lifecycle.user.reactivate'),
  ('ORGANIZATION_ADMIN', 'lifecycle.user.request_delete'),
  ('ORGANIZATION_ADMIN', 'lifecycle.user.review_delete'),
  ('ORGANIZATION_ADMIN', 'lifecycle.export'),
  ('ORGANIZATION_ADMIN', 'lifecycle.dsr.manage')
ON CONFLICT (role, permission) DO NOTHING;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS termination_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termination_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT,
  ADD COLUMN IF NOT EXISTS operational_shutdown_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_only_retention_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_eligible_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifecycle_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_lifecycle_status_check') THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_lifecycle_status_check
      CHECK (lifecycle_status IN ('ACTIVE', 'SUSPENDED', 'TERMINATION_REQUESTED', 'READ_ONLY_RETENTION', 'PURGE_ELIGIBLE', 'PURGED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS organizations_lifecycle_status_idx
  ON organizations(lifecycle_status, status);

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by TEXT,
  ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reactivated_by TEXT,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_purge_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pseudonymous_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by TEXT,
  ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reactivated_by TEXT,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_purge_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pseudonymous_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE warehouse_employees
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by TEXT,
  ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reactivated_by TEXT,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_purge_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pseudonymous_actor_id TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_lifecycle_status_check') THEN
    ALTER TABLE admin_users
      ADD CONSTRAINT admin_users_lifecycle_status_check
      CHECK (lifecycle_status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'DELETION_REQUESTED', 'SOFT_DELETED', 'ANONYMIZED', 'PURGED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drivers_lifecycle_status_check') THEN
    ALTER TABLE drivers
      ADD CONSTRAINT drivers_lifecycle_status_check
      CHECK (lifecycle_status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'DELETION_REQUESTED', 'SOFT_DELETED', 'ANONYMIZED', 'PURGED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_employees_lifecycle_status_check') THEN
    ALTER TABLE warehouse_employees
      ADD CONSTRAINT warehouse_employees_lifecycle_status_check
      CHECK (lifecycle_status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'DELETION_REQUESTED', 'SOFT_DELETED', 'ANONYMIZED', 'PURGED'));
  END IF;
END $$;

UPDATE admin_users SET lifecycle_status = CASE WHEN active THEN 'ACTIVE' ELSE 'DEACTIVATED' END WHERE lifecycle_status = 'ACTIVE' AND active = false;
UPDATE drivers SET lifecycle_status = CASE WHEN active THEN 'ACTIVE' ELSE 'DEACTIVATED' END WHERE lifecycle_status = 'ACTIVE' AND active = false;
UPDATE warehouse_employees SET lifecycle_status = CASE WHEN active THEN 'ACTIVE' ELSE 'DEACTIVATED' END WHERE lifecycle_status = 'ACTIVE' AND active = false;

CREATE INDEX IF NOT EXISTS admin_users_lifecycle_status_idx ON admin_users(organization_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS drivers_lifecycle_status_idx ON drivers(organization_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS warehouse_employees_lifecycle_status_idx ON warehouse_employees(organization_id, lifecycle_status);

CREATE TABLE IF NOT EXISTS retention_policies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id),
  data_class TEXT NOT NULL,
  policy_scope TEXT NOT NULL DEFAULT 'platform_default',
  retention_days INTEGER,
  recovery_days INTEGER,
  action TEXT NOT NULL DEFAULT 'POLICY_DECISION_REQUIRED',
  decision_status TEXT NOT NULL DEFAULT 'POLICY_DECISION_REQUIRED',
  legal_hold_eligible BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT retention_policies_days_check CHECK (
    (retention_days IS NULL OR retention_days >= 0)
    AND (recovery_days IS NULL OR recovery_days >= 0)
  ),
  CONSTRAINT retention_policies_action_check CHECK (action IN (
    'CASCADE', 'RESTRICT', 'SET NULL', 'SOFT DELETE', 'HARD DELETE', 'ANONYMIZE',
    'PSEUDONYMIZE', 'DETACH', 'ARCHIVE', 'RETAIN', 'LEGAL HOLD',
    'PLATFORM-GLOBAL PRESERVE', 'POLICY_DECISION_REQUIRED'
  ))
);

CREATE UNIQUE INDEX IF NOT EXISTS retention_policies_scope_class_idx
  ON retention_policies(COALESCE(organization_id, 'platform'), policy_scope, data_class);

INSERT INTO retention_policies (data_class, policy_scope, recovery_days, action, decision_status, legal_hold_eligible, created_by)
VALUES
  ('account_recovery', 'platform_default', 30, 'SOFT DELETE', 'APPROVED_DEFAULT', true, 'ODR-019'),
  ('temporary_transient_data', 'platform_default', NULL, 'POLICY_DECISION_REQUIRED', 'POLICY_DECISION_REQUIRED', false, 'ODR-019'),
  ('authentication_artifacts', 'platform_default', NULL, 'HARD DELETE', 'POLICY_DECISION_REQUIRED', false, 'ODR-019'),
  ('operational_historical_data', 'platform_default', NULL, 'RETAIN', 'POLICY_DECISION_REQUIRED', true, 'ODR-019'),
  ('analytical_snapshots', 'platform_default', NULL, 'RETAIN', 'POLICY_DECISION_REQUIRED', true, 'ODR-019'),
  ('audit_data', 'platform_default', NULL, 'RETAIN', 'POLICY_DECISION_REQUIRED', true, 'ODR-019'),
  ('platform_global_shared_safety', 'platform_default', NULL, 'PLATFORM-GLOBAL PRESERVE', 'POLICY_DECISION_REQUIRED', true, 'ODR-019'),
  ('object_storage_assets', 'platform_default', NULL, 'POLICY_DECISION_REQUIRED', 'POLICY_DECISION_REQUIRED', true, 'ODR-019'),
  ('organization_termination', 'platform_default', NULL, 'ARCHIVE', 'POLICY_DECISION_REQUIRED', true, 'ODR-019')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS legal_holds (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id),
  scope_type TEXT NOT NULL,
  scope_id TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  authorized_by TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_by TEXT,
  released_at TIMESTAMPTZ,
  release_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT legal_holds_status_check CHECK (status IN ('ACTIVE', 'RELEASED')),
  CONSTRAINT legal_holds_scope_check CHECK (scope_type IN ('USER', 'DRIVER', 'WAREHOUSE_EMPLOYEE', 'ORGANIZATION', 'ROUTE', 'STOP', 'DELIVERY', 'MEDIA', 'AUDIT', 'SHARED_SAFETY', 'GLOBAL'))
);

CREATE INDEX IF NOT EXISTS legal_holds_scope_idx
  ON legal_holds(organization_id, scope_type, scope_id, status);

CREATE TABLE IF NOT EXISTS lifecycle_deletion_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id),
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  requester_actor_type TEXT NOT NULL,
  requester_actor_id TEXT NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'DELETION',
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recovery_window_days INTEGER NOT NULL DEFAULT 30,
  recovery_deadline_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  decision TEXT,
  decision_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  canceled_by TEXT,
  canceled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT lifecycle_deletion_subject_check CHECK (subject_type IN ('ADMIN_USER', 'DRIVER', 'WAREHOUSE_EMPLOYEE', 'ORGANIZATION')),
  CONSTRAINT lifecycle_deletion_status_check CHECK (status IN ('REQUESTED', 'IN_REVIEW', 'CANCELED', 'APPROVED', 'DENIED', 'COMPLETED')),
  CONSTRAINT lifecycle_deletion_decision_check CHECK (
    decision IS NULL OR decision IN ('DELETE', 'ANONYMIZE', 'PARTIALLY_DELETE', 'RETAIN_UNDER_POLICY', 'RETAIN_UNDER_LEGAL_HOLD', 'REJECT_WITH_DOCUMENTED_REASON')
  )
);

CREATE INDEX IF NOT EXISTS lifecycle_deletion_requests_org_subject_idx
  ON lifecycle_deletion_requests(organization_id, subject_type, subject_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS data_subject_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id),
  request_type TEXT NOT NULL,
  requester_actor_type TEXT NOT NULL,
  requester_actor_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  decision TEXT,
  reason TEXT,
  reviewer_actor_id TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT data_subject_requests_type_check CHECK (request_type IN ('ACCESS', 'EXPORT', 'CORRECTION', 'DELETION', 'RESTRICTION')),
  CONSTRAINT data_subject_requests_status_check CHECK (status IN ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED')),
  CONSTRAINT data_subject_requests_decision_check CHECK (
    decision IS NULL OR decision IN ('DELETE', 'ANONYMIZE', 'PARTIALLY_DELETE', 'RETAIN_UNDER_POLICY', 'RETAIN_UNDER_LEGAL_HOLD', 'REJECT_WITH_DOCUMENTED_REASON')
  )
);

CREATE INDEX IF NOT EXISTS data_subject_requests_org_subject_idx
  ON data_subject_requests(organization_id, subject_type, subject_id, status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS organization_lifecycle_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'recorded',
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organization_lifecycle_events_org_idx
  ON organization_lifecycle_events(organization_id, event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS lifecycle_object_references (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id),
  owner_table TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  object_kind TEXT NOT NULL,
  storage_provider TEXT,
  storage_key TEXT NOT NULL,
  contains_personal_data BOOLEAN NOT NULL DEFAULT false,
  legal_hold_eligible BOOLEAN NOT NULL DEFAULT true,
  lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
  purge_eligible_at TIMESTAMPTZ,
  purged_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lifecycle_object_refs_status_check CHECK (lifecycle_status IN ('ACTIVE', 'RETAINED', 'PURGE_ELIGIBLE', 'PURGED'))
);

CREATE INDEX IF NOT EXISTS lifecycle_object_references_owner_idx
  ON lifecycle_object_references(organization_id, owner_table, owner_id);
CREATE INDEX IF NOT EXISTS lifecycle_object_references_purge_idx
  ON lifecycle_object_references(lifecycle_status, purge_eligible_at)
  WHERE lifecycle_status = 'PURGE_ELIGIBLE';

CREATE TABLE IF NOT EXISTS lifecycle_purge_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  preview JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PREVIEWED',
  dry_run BOOLEAN NOT NULL DEFAULT true,
  requested_by TEXT NOT NULL,
  confirmed_by TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT lifecycle_purge_jobs_status_check CHECK (status IN ('PREVIEWED', 'APPROVED', 'RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED')),
  CONSTRAINT lifecycle_purge_jobs_target_check CHECK (target_type IN ('USER', 'DRIVER', 'WAREHOUSE_EMPLOYEE', 'ORGANIZATION', 'EPHEMERAL_RECORDS'))
);

CREATE INDEX IF NOT EXISTS lifecycle_purge_jobs_org_target_idx
  ON lifecycle_purge_jobs(organization_id, target_type, target_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS lifecycle_tombstones (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  tombstone_type TEXT NOT NULL,
  action TEXT NOT NULL,
  action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action_by TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS lifecycle_tombstones_target_action_idx
  ON lifecycle_tombstones(COALESCE(organization_id, 'platform'), target_type, target_id, tombstone_type, action);

CREATE TABLE IF NOT EXISTS data_exports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  export_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  requested_by TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  object_reference_id TEXT REFERENCES lifecycle_object_references(id) ON DELETE SET NULL,
  manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT data_exports_status_check CHECK (status IN ('REQUESTED', 'PREVIEWED', 'APPROVED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED'))
);

CREATE INDEX IF NOT EXISTS data_exports_org_status_idx
  ON data_exports(organization_id, status, requested_at DESC);

CREATE TABLE IF NOT EXISTS lifecycle_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id),
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'success',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lifecycle_events_target_idx
  ON lifecycle_events(organization_id, target_type, target_id, event_type, occurred_at DESC);

CREATE OR REPLACE FUNCTION prevent_audit_events_delete_without_lifecycle_override()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('tsr.allow_audit_delete', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'audit_events are immutable under ODR-019 lifecycle governance';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_lifecycle_immutable_trg ON audit_events;
CREATE TRIGGER audit_events_lifecycle_immutable_trg
  BEFORE DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_events_delete_without_lifecycle_override();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'route_session_events'
      AND constraint_name = 'route_session_events_route_session_id_fkey'
  ) THEN
    ALTER TABLE route_session_events
      DROP CONSTRAINT route_session_events_route_session_id_fkey;
    ALTER TABLE route_session_events
      ADD CONSTRAINT route_session_events_route_session_id_fkey
      FOREIGN KEY (route_session_id) REFERENCES route_sessions(id) ON DELETE RESTRICT;
  END IF;
END $$;
