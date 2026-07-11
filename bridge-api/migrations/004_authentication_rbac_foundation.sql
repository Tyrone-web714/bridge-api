BEGIN;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS internal_user_id TEXT,
  ADD COLUMN IF NOT EXISTS approved_role TEXT,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

UPDATE admin_users
SET
  internal_user_id = COALESCE(internal_user_id, username),
  approved_role = COALESCE(
    approved_role,
    CASE
      WHEN LOWER(TRIM(role)) IN ('admin', 'platform_admin', 'platform admin') THEN 'PLATFORM_ADMIN'
      WHEN LOWER(TRIM(role)) IN ('regional_admin', 'regional', 'organization_admin', 'org_admin', 'organization admin') THEN 'ORGANIZATION_ADMIN'
      WHEN LOWER(TRIM(role)) = 'driver' THEN 'DRIVER'
      WHEN LOWER(TRIM(role)) IN ('warehouse', 'warehouse_employee', 'warehouse employee') THEN 'WAREHOUSE_EMPLOYEE'
      ELSE 'SUPERVISOR'
    END
  );

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_internal_user_id_unique_idx
  ON admin_users(internal_user_id)
  WHERE internal_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, permission)
);

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS organization_id TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS outcome TEXT,
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE driver_sessions
  ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

ALTER TABLE warehouse_employees
  ADD COLUMN IF NOT EXISTS failed_auth_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_employees_org_company_employee_unique_idx
  ON warehouse_employees(organization_id, LOWER(company_employee_id))
  WHERE organization_id IS NOT NULL AND company_employee_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS warehouse_employee_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  employee_id TEXT NOT NULL REFERENCES warehouse_employees(employee_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS warehouse_employee_sessions_employee_idx
  ON warehouse_employee_sessions(organization_id, employee_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS warehouse_employee_sessions_token_idx
  ON warehouse_employee_sessions(token_hash);

COMMIT;
