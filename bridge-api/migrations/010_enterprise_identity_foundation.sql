CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO role_permissions (role, permission)
VALUES
  ('PLATFORM_ADMIN', 'identity.provider.view'),
  ('PLATFORM_ADMIN', 'identity.provider.manage'),
  ('PLATFORM_ADMIN', 'identity.domain.manage'),
  ('PLATFORM_ADMIN', 'identity.mapping.manage'),
  ('PLATFORM_ADMIN', 'identity.sso_policy.manage'),
  ('PLATFORM_ADMIN', 'identity.account_link.manage'),
  ('PLATFORM_ADMIN', 'identity.scim.manage'),
  ('PLATFORM_ADMIN', 'identity.break_glass.manage'),
  ('PLATFORM_ADMIN', 'identity.audit.view'),
  ('PLATFORM_ADMIN', 'platform.identity.support'),
  ('ORGANIZATION_ADMIN', 'identity.provider.view'),
  ('ORGANIZATION_ADMIN', 'identity.provider.manage'),
  ('ORGANIZATION_ADMIN', 'identity.domain.manage'),
  ('ORGANIZATION_ADMIN', 'identity.mapping.manage'),
  ('ORGANIZATION_ADMIN', 'identity.sso_policy.manage'),
  ('ORGANIZATION_ADMIN', 'identity.account_link.manage'),
  ('ORGANIZATION_ADMIN', 'identity.scim.manage'),
  ('ORGANIZATION_ADMIN', 'identity.break_glass.manage'),
  ('ORGANIZATION_ADMIN', 'identity.audit.view')
ON CONFLICT (role, permission) DO NOTHING;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sso_policy_state TEXT NOT NULL DEFAULT 'LOCAL_ALLOWED',
  ADD COLUMN IF NOT EXISTS sso_policy_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sso_policy_updated_by TEXT,
  ADD COLUMN IF NOT EXISTS jit_policy_state TEXT NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN IF NOT EXISTS jit_policy_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS jit_policy_updated_by TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_sso_policy_state_check') THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_sso_policy_state_check
      CHECK (sso_policy_state IN ('LOCAL_ALLOWED', 'SSO_OPTIONAL', 'SSO_REQUIRED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_jit_policy_state_check') THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_jit_policy_state_check
      CHECK (jit_policy_state IN ('DISABLED', 'INVITED_USERS_ONLY', 'MINIMUM_ACCESS'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS organization_memberships (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  internal_user_id TEXT,
  approved_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  source TEXT NOT NULL DEFAULT 'LOCAL',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_by TEXT,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT organization_memberships_subject_check CHECK (subject_type IN ('ADMIN_USER', 'DRIVER', 'WAREHOUSE_EMPLOYEE')),
  CONSTRAINT organization_memberships_role_check CHECK (approved_role IN ('ORGANIZATION_ADMIN', 'SUPERVISOR', 'DRIVER', 'WAREHOUSE_EMPLOYEE')),
  CONSTRAINT organization_memberships_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  CONSTRAINT organization_memberships_no_platform_admin_check CHECK (approved_role <> 'PLATFORM_ADMIN')
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_org_subject_unique_idx
  ON organization_memberships(organization_id, subject_type, subject_id);

CREATE INDEX IF NOT EXISTS organization_memberships_internal_user_idx
  ON organization_memberships(internal_user_id, organization_id, status)
  WHERE internal_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS organization_identity_providers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  protocol TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  enabled BOOLEAN NOT NULL DEFAULT false,
  sso_enforcement_policy TEXT NOT NULL DEFAULT 'LOCAL_ALLOWED',
  jit_policy TEXT NOT NULL DEFAULT 'DISABLED',
  issuer TEXT,
  client_id TEXT,
  secret_ref TEXT,
  secret_version TEXT,
  secret_rotated_at TIMESTAMPTZ,
  discovery_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  jwks_ref TEXT,
  saml_entity_id TEXT,
  saml_sso_url TEXT,
  saml_certificate_ref TEXT,
  saml_metadata_ref TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  disabled_by TEXT,
  lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT organization_idp_protocol_check CHECK (protocol IN ('OIDC', 'SAML')),
  CONSTRAINT organization_idp_provider_type_check CHECK (provider_type IN ('MICROSOFT_ENTRA', 'OKTA', 'GOOGLE', 'GENERIC_OIDC', 'GENERIC_SAML')),
  CONSTRAINT organization_idp_status_check CHECK (status IN ('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'DISABLED', 'ARCHIVED')),
  CONSTRAINT organization_idp_sso_policy_check CHECK (sso_enforcement_policy IN ('LOCAL_ALLOWED', 'SSO_OPTIONAL', 'SSO_REQUIRED')),
  CONSTRAINT organization_idp_jit_policy_check CHECK (jit_policy IN ('DISABLED', 'INVITED_USERS_ONLY', 'MINIMUM_ACCESS')),
  CONSTRAINT organization_idp_lifecycle_check CHECK (lifecycle_status IN ('ACTIVE', 'DEACTIVATED', 'ARCHIVED', 'PURGED')),
  CONSTRAINT organization_idp_protocol_provider_check CHECK (
    (protocol = 'OIDC' AND provider_type IN ('MICROSOFT_ENTRA', 'OKTA', 'GOOGLE', 'GENERIC_OIDC'))
    OR (protocol = 'SAML' AND provider_type IN ('MICROSOFT_ENTRA', 'OKTA', 'GOOGLE', 'GENERIC_SAML'))
  )
);

CREATE INDEX IF NOT EXISTS organization_idp_org_idx
  ON organization_identity_providers(organization_id, enabled, status);

CREATE UNIQUE INDEX IF NOT EXISTS organization_idp_org_display_unique_idx
  ON organization_identity_providers(organization_id, LOWER(display_name));

CREATE TABLE IF NOT EXISTS verified_organization_domains (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  domain TEXT NOT NULL,
  verification_state TEXT NOT NULL DEFAULT 'PENDING',
  verification_method TEXT NOT NULL DEFAULT 'DNS_TXT',
  verification_challenge TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT verified_domains_state_check CHECK (verification_state IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED', 'REVOKED')),
  CONSTRAINT verified_domains_method_check CHECK (verification_method IN ('DNS_TXT', 'MANUAL_PLATFORM_REVIEW'))
);

CREATE UNIQUE INDEX IF NOT EXISTS verified_org_domains_domain_unique_idx
  ON verified_organization_domains(LOWER(domain))
  WHERE verification_state = 'VERIFIED';

CREATE INDEX IF NOT EXISTS verified_org_domains_org_idx
  ON verified_organization_domains(organization_id, verification_state);

CREATE TABLE IF NOT EXISTS federated_identities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  identity_provider_id TEXT NOT NULL REFERENCES organization_identity_providers(id) ON DELETE RESTRICT,
  internal_user_id TEXT NOT NULL,
  external_subject TEXT NOT NULL,
  protocol TEXT NOT NULL,
  verified_email TEXT,
  display_name TEXT,
  lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
  linked_by TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_authenticated_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  disabled_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT federated_identities_protocol_check CHECK (protocol IN ('OIDC', 'SAML')),
  CONSTRAINT federated_identities_lifecycle_check CHECK (lifecycle_status IN ('ACTIVE', 'DISABLED', 'DELINKED', 'PURGED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS federated_identities_provider_subject_unique_idx
  ON federated_identities(identity_provider_id, external_subject);

CREATE INDEX IF NOT EXISTS federated_identities_internal_user_idx
  ON federated_identities(organization_id, internal_user_id, lifecycle_status);

CREATE TABLE IF NOT EXISTS identity_claim_mappings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  identity_provider_id TEXT NOT NULL REFERENCES organization_identity_providers(id) ON DELETE RESTRICT,
  claim_name TEXT NOT NULL,
  claim_value TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_role TEXT,
  target_permission TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT identity_claim_mappings_target_type_check CHECK (target_type IN ('ROLE', 'PERMISSION')),
  CONSTRAINT identity_claim_mappings_role_check CHECK (target_role IS NULL OR target_role IN ('ORGANIZATION_ADMIN', 'SUPERVISOR', 'DRIVER', 'WAREHOUSE_EMPLOYEE')),
  CONSTRAINT identity_claim_mappings_permission_check CHECK (target_permission IS NULL OR target_permission <> 'platform.identity.support'),
  CONSTRAINT identity_claim_mappings_no_platform_admin_check CHECK (target_role IS NULL OR target_role <> 'PLATFORM_ADMIN')
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_claim_mappings_unique_idx
  ON identity_claim_mappings(organization_id, identity_provider_id, LOWER(claim_name), LOWER(claim_value), target_type, COALESCE(target_role, ''), COALESCE(target_permission, ''));

CREATE TABLE IF NOT EXISTS sso_authentication_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  identity_provider_id TEXT NOT NULL REFERENCES organization_identity_providers(id) ON DELETE RESTRICT,
  protocol TEXT NOT NULL,
  state_hash TEXT NOT NULL,
  nonce_hash TEXT,
  pkce_challenge_hash TEXT,
  redirect_ref TEXT,
  redirect_uri TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by_federated_identity_id TEXT REFERENCES federated_identities(id) ON DELETE SET NULL,
  failure_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT sso_transactions_protocol_check CHECK (protocol IN ('OIDC', 'SAML')),
  CONSTRAINT sso_transactions_status_check CHECK (status IN ('PENDING', 'CONSUMED', 'EXPIRED', 'FAILED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS sso_transactions_state_hash_unique_idx
  ON sso_authentication_transactions(state_hash);

CREATE INDEX IF NOT EXISTS sso_transactions_expiration_idx
  ON sso_authentication_transactions(status, expires_at);

CREATE TABLE IF NOT EXISTS scim_configurations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  identity_provider_id TEXT REFERENCES organization_identity_providers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DISABLED',
  credential_ref TEXT,
  credential_version TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT scim_configurations_status_check CHECK (status IN ('DISABLED', 'ENABLED', 'SUSPENDED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS scim_configurations_org_provider_unique_idx
  ON scim_configurations(organization_id, COALESCE(identity_provider_id, 'organization'));

CREATE TABLE IF NOT EXISTS scim_provisioning_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  scim_configuration_id TEXT REFERENCES scim_configurations(id) ON DELETE SET NULL,
  identity_provider_id TEXT REFERENCES organization_identity_providers(id) ON DELETE SET NULL,
  external_subject TEXT,
  internal_user_id TEXT,
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scim_events_type_check CHECK (event_type IN ('CREATE', 'UPDATE', 'DEACTIVATE', 'REACTIVATE', 'GROUP_CHANGE')),
  CONSTRAINT scim_events_status_check CHECK (status IN ('RECEIVED', 'APPLIED', 'IGNORED', 'FAILED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS scim_events_idempotency_unique_idx
  ON scim_provisioning_events(organization_id, idempotency_key);

CREATE TABLE IF NOT EXISTS enterprise_identity_break_glass_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED',
  approved_by TEXT,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT break_glass_status_check CHECK (status IN ('REQUESTED', 'APPROVED', 'ACTIVE', 'EXPIRED', 'CLOSED', 'DENIED'))
);

CREATE INDEX IF NOT EXISTS break_glass_org_status_idx
  ON enterprise_identity_break_glass_records(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS identity_security_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT,
  identity_provider_id TEXT REFERENCES organization_identity_providers(id) ON DELETE SET NULL,
  federated_identity_id TEXT REFERENCES federated_identities(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT,
  actor_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'recorded',
  request_id TEXT,
  network_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS identity_security_events_org_type_idx
  ON identity_security_events(organization_id, event_type, occurred_at DESC);

INSERT INTO retention_policies (data_class, policy_scope, action, decision_status, legal_hold_eligible, created_by)
VALUES
  ('enterprise_identity_provider_configuration', 'platform_default', 'RETAIN', 'POLICY_DECISION_REQUIRED', true, 'ODR-020'),
  ('enterprise_federated_identity_mapping', 'platform_default', 'PSEUDONYMIZE', 'POLICY_DECISION_REQUIRED', true, 'ODR-020'),
  ('enterprise_sso_authentication_transactions', 'platform_default', 'HARD DELETE', 'POLICY_DECISION_REQUIRED', false, 'ODR-020'),
  ('enterprise_identity_security_events', 'platform_default', 'RETAIN', 'POLICY_DECISION_REQUIRED', true, 'ODR-020'),
  ('enterprise_scim_events', 'platform_default', 'RETAIN', 'POLICY_DECISION_REQUIRED', true, 'ODR-020')
ON CONFLICT DO NOTHING;
