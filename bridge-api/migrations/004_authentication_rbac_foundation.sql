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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_approved_role_check'
  ) THEN
    ALTER TABLE admin_users
      ADD CONSTRAINT admin_users_approved_role_check
      CHECK (approved_role IN ('PLATFORM_ADMIN', 'ORGANIZATION_ADMIN', 'SUPERVISOR', 'DRIVER', 'WAREHOUSE_EMPLOYEE'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_role_check'
  ) THEN
    ALTER TABLE role_permissions
      ADD CONSTRAINT role_permissions_role_check
      CHECK (role IN ('PLATFORM_ADMIN', 'ORGANIZATION_ADMIN', 'SUPERVISOR', 'DRIVER', 'WAREHOUSE_EMPLOYEE'));
  END IF;
END $$;

INSERT INTO role_permissions (role, permission)
VALUES
  ('PLATFORM_ADMIN', 'platform.organizations.manage'),
  ('PLATFORM_ADMIN', 'platform.configure'),
  ('PLATFORM_ADMIN', 'billing.manage'),
  ('PLATFORM_ADMIN', 'shared_safety.approve'),
  ('PLATFORM_ADMIN', 'users.manage'),
  ('PLATFORM_ADMIN', 'drivers.view'),
  ('PLATFORM_ADMIN', 'drivers.manage'),
  ('PLATFORM_ADMIN', 'vehicles.manage'),
  ('PLATFORM_ADMIN', 'routes.view'),
  ('PLATFORM_ADMIN', 'routes.manage'),
  ('PLATFORM_ADMIN', 'routes.assign'),
  ('PLATFORM_ADMIN', 'stops.manage'),
  ('PLATFORM_ADMIN', 'accounts.view'),
  ('PLATFORM_ADMIN', 'delivery.operate'),
  ('PLATFORM_ADMIN', 'warehouse.confirm'),
  ('PLATFORM_ADMIN', 'hazards.submit'),
  ('PLATFORM_ADMIN', 'hazards.review'),
  ('PLATFORM_ADMIN', 'dashboard.view'),
  ('PLATFORM_ADMIN', 'dashboard.manage'),
  ('PLATFORM_ADMIN', 'reports.view'),
  ('PLATFORM_ADMIN', 'reports.export'),
  ('PLATFORM_ADMIN', 'route_replay.view'),
  ('PLATFORM_ADMIN', 'audit.view'),
  ('ORGANIZATION_ADMIN', 'users.manage'),
  ('ORGANIZATION_ADMIN', 'drivers.view'),
  ('ORGANIZATION_ADMIN', 'drivers.manage'),
  ('ORGANIZATION_ADMIN', 'vehicles.manage'),
  ('ORGANIZATION_ADMIN', 'routes.view'),
  ('ORGANIZATION_ADMIN', 'routes.manage'),
  ('ORGANIZATION_ADMIN', 'routes.assign'),
  ('ORGANIZATION_ADMIN', 'stops.manage'),
  ('ORGANIZATION_ADMIN', 'accounts.view'),
  ('ORGANIZATION_ADMIN', 'delivery.operate'),
  ('ORGANIZATION_ADMIN', 'warehouse.confirm'),
  ('ORGANIZATION_ADMIN', 'hazards.submit'),
  ('ORGANIZATION_ADMIN', 'hazards.review'),
  ('ORGANIZATION_ADMIN', 'dashboard.view'),
  ('ORGANIZATION_ADMIN', 'dashboard.manage'),
  ('ORGANIZATION_ADMIN', 'reports.view'),
  ('ORGANIZATION_ADMIN', 'reports.export'),
  ('ORGANIZATION_ADMIN', 'route_replay.view'),
  ('ORGANIZATION_ADMIN', 'audit.view'),
  ('SUPERVISOR', 'drivers.view'),
  ('SUPERVISOR', 'drivers.manage'),
  ('SUPERVISOR', 'routes.view'),
  ('SUPERVISOR', 'routes.manage'),
  ('SUPERVISOR', 'routes.assign'),
  ('SUPERVISOR', 'stops.manage'),
  ('SUPERVISOR', 'accounts.view'),
  ('SUPERVISOR', 'delivery.operate'),
  ('SUPERVISOR', 'hazards.review'),
  ('SUPERVISOR', 'dashboard.view'),
  ('SUPERVISOR', 'reports.view'),
  ('SUPERVISOR', 'reports.export'),
  ('SUPERVISOR', 'route_replay.view'),
  ('DRIVER', 'routes.view'),
  ('DRIVER', 'stops.manage'),
  ('DRIVER', 'delivery.operate'),
  ('DRIVER', 'hazards.submit'),
  ('WAREHOUSE_EMPLOYEE', 'routes.view'),
  ('WAREHOUSE_EMPLOYEE', 'warehouse.confirm')
ON CONFLICT (role, permission) DO NOTHING;

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
