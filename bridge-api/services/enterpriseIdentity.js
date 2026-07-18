const crypto = require('crypto');
const postgres = require('../db/postgres');
const rbac = require('./rbac');
const { assertSameOrganization, BOOTSTRAP_ORGANIZATION } = require('./tenantContext');

const PROTOCOLS = Object.freeze(['OIDC', 'SAML']);
const PROVIDER_TYPES = Object.freeze(['MICROSOFT_ENTRA', 'OKTA', 'GOOGLE', 'GENERIC_OIDC', 'GENERIC_SAML']);
const SSO_POLICIES = Object.freeze(['LOCAL_ALLOWED', 'SSO_OPTIONAL', 'SSO_REQUIRED']);
const JIT_POLICIES = Object.freeze(['DISABLED', 'INVITED_USERS_ONLY', 'MINIMUM_ACCESS']);
const PROVIDER_STATUSES = Object.freeze(['DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'DISABLED', 'ARCHIVED']);
const SAFE_REDIRECT_REFS = Object.freeze(['admin_dashboard', 'mobile_app', 'driver_home']);
const SENSITIVE_KEYS = /token|secret|password|assertion|code|private|credential|client_secret|refresh/i;

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeCode(value, allowed, fallback = null) {
  const code = cleanText(value, 80).toUpperCase().replace(/[\s-]+/g, '_');
  return allowed.includes(code) ? code : fallback;
}

function normalizeDomain(value) {
  return cleanText(value, 253).toLowerCase().replace(/^@+/, '').replace(/\.+$/, '');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function assertSecretReference(value, required = false) {
  const secretRef = cleanText(value, 240);
  if (!secretRef) {
    if (required) throw createError('secretRef is required. Raw secrets are not accepted.', 400, 'SECRET_REFERENCE_REQUIRED');
    return null;
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\/[\w./:@-]+$/i.test(secretRef)
    || /^([A-Za-z0-9+/=_-]{24,}|[a-f0-9]{32,})$/.test(secretRef)) {
    throw createError('Use a secret-manager reference, not a raw secret value.', 400, 'RAW_SECRET_REJECTED');
  }
  return secretRef;
}

function createError(message, status = 400, code = 'ENTERPRISE_IDENTITY_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function assertDatabase() {
  if (!postgres.isDatabaseConfigured()) {
    throw createError('Enterprise identity requires PostgreSQL.', 503, 'DATABASE_REQUIRED');
  }
}

function redactObject(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactObject);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEYS.test(key) ? '[REDACTED]' : redactObject(item)
  ]));
}

function actorId(authContext = {}) {
  return cleanText(authContext.actorId || authContext.username || 'system', 160) || 'system';
}

function assertAuthenticated(authContext = {}) {
  if (!authContext.authenticated) {
    throw createError('Authentication is required.', 401, 'AUTHENTICATION_REQUIRED');
  }
}

function assertOrganizationScope(authContext = {}, requestedOrganizationId) {
  assertAuthenticated(authContext);
  const requested = cleanText(requestedOrganizationId || authContext.organizationId, 160);
  if (!requested) {
    throw createError('Organization context is required.', 403, 'ORGANIZATION_CONTEXT_REQUIRED');
  }
  if (authContext.approvedRole !== rbac.ROLES.PLATFORM_ADMIN) {
    assertSameOrganization(authContext.organizationId, requested);
  }
  return requested;
}

async function recordIdentityEvent(input = {}) {
  if (!postgres.isDatabaseConfigured()) return null;
  const executor = input.client || postgres;
  const result = await executor.query(`
    INSERT INTO identity_security_events (
      organization_id, identity_provider_id, federated_identity_id, event_type,
      actor_type, actor_id, outcome, request_id, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    RETURNING *
  `, [
    cleanText(input.organizationId, 160) || null,
    cleanText(input.identityProviderId, 160) || null,
    cleanText(input.federatedIdentityId, 160) || null,
    cleanText(input.eventType, 120),
    cleanText(input.actorType || 'system', 80) || 'system',
    cleanText(input.actorId || 'system', 160) || 'system',
    cleanText(input.outcome || 'recorded', 80) || 'recorded',
    cleanText(input.requestId, 160) || null,
    JSON.stringify(redactObject(input.metadata || {}))
  ]);
  return result.rows[0] || null;
}

function providerFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    protocol: row.protocol,
    providerType: row.provider_type,
    displayName: row.display_name,
    status: row.status,
    enabled: row.enabled === true,
    ssoEnforcementPolicy: row.sso_enforcement_policy,
    jitPolicy: row.jit_policy,
    issuer: row.issuer || null,
    clientId: row.client_id || null,
    secretRef: row.secret_ref ? '[REDACTED_REFERENCE]' : null,
    secretVersion: row.secret_version || null,
    secretRotatedAt: row.secret_rotated_at ? row.secret_rotated_at.toISOString() : null,
    discoveryMetadata: redactObject(row.discovery_metadata || {}),
    jwksRef: row.jwks_ref || null,
    samlEntityId: row.saml_entity_id || null,
    samlSsoUrl: row.saml_sso_url || null,
    samlCertificateRef: row.saml_certificate_ref ? '[REDACTED_REFERENCE]' : null,
    samlMetadataRef: row.saml_metadata_ref || null,
    lifecycleStatus: row.lifecycle_status || 'ACTIVE',
    metadata: redactObject(row.metadata || {}),
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null
  };
}

function domainFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    domain: row.domain,
    verificationState: row.verification_state,
    verificationMethod: row.verification_method,
    verificationChallenge: row.verification_challenge,
    verifiedAt: row.verified_at ? row.verified_at.toISOString() : null
  };
}

function mappingFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    identityProviderId: row.identity_provider_id,
    claimName: row.claim_name,
    claimValue: row.claim_value,
    targetType: row.target_type,
    targetRole: row.target_role || null,
    targetPermission: row.target_permission || null,
    enabled: row.enabled === true
  };
}

function federatedIdentityFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    identityProviderId: row.identity_provider_id,
    internalUserId: row.internal_user_id,
    externalSubject: row.external_subject,
    protocol: row.protocol,
    verifiedEmail: row.verified_email || null,
    displayName: row.display_name || null,
    lifecycleStatus: row.lifecycle_status || 'ACTIVE',
    linkedAt: row.linked_at ? row.linked_at.toISOString() : null,
    lastAuthenticatedAt: row.last_authenticated_at ? row.last_authenticated_at.toISOString() : null
  };
}

async function getOrganizationActive(organizationId) {
  const result = await postgres.query(`
    SELECT *
    FROM organizations
    WHERE id = $1
      AND status = 'active'
      AND COALESCE(lifecycle_status, 'ACTIVE') = 'ACTIVE'
    LIMIT 1
  `, [organizationId]);
  return result.rows[0] || null;
}

async function getProviderRaw(id, organizationId = null) {
  const values = [cleanText(id, 160)];
  const where = ['id = $1'];
  if (organizationId) {
    values.push(cleanText(organizationId, 160));
    where.push(`organization_id = $${values.length}`);
  }
  const result = await postgres.query(`
    SELECT *
    FROM organization_identity_providers
    WHERE ${where.join(' AND ')}
    LIMIT 1
  `, values);
  return result.rows[0] || null;
}

function validateProtocolProvider(protocol, providerType) {
  if (!PROTOCOLS.includes(protocol)) throw createError('Unsupported identity protocol.', 400, 'UNSUPPORTED_IDENTITY_PROTOCOL');
  if (!PROVIDER_TYPES.includes(providerType)) throw createError('Unsupported identity provider type.', 400, 'UNSUPPORTED_IDENTITY_PROVIDER');
  if (protocol === 'OIDC' && providerType === 'GENERIC_SAML') {
    throw createError('OIDC providers cannot use GENERIC_SAML provider type.', 400, 'PROTOCOL_PROVIDER_MISMATCH');
  }
  if (protocol === 'SAML' && providerType === 'GENERIC_OIDC') {
    throw createError('SAML providers cannot use GENERIC_OIDC provider type.', 400, 'PROTOCOL_PROVIDER_MISMATCH');
  }
}

async function listIdentityProviders(authContext, input = {}) {
  assertDatabase();
  const organizationId = assertOrganizationScope(authContext, input.organizationId);
  const result = await postgres.query(`
    SELECT *
    FROM organization_identity_providers
    WHERE organization_id = $1
    ORDER BY display_name
  `, [organizationId]);
  return { ok: true, providers: result.rows.map(providerFromRow) };
}

async function createIdentityProvider(authContext, input = {}) {
  assertDatabase();
  const organizationId = assertOrganizationScope(authContext, input.organizationId);
  const protocol = normalizeCode(input.protocol, PROTOCOLS);
  const providerType = normalizeCode(input.providerType || input.provider_type, PROVIDER_TYPES);
  validateProtocolProvider(protocol, providerType);
  const displayName = cleanText(input.displayName || input.display_name, 160);
  if (!displayName) throw createError('displayName is required.', 400, 'DISPLAY_NAME_REQUIRED');
  const status = normalizeCode(input.status, PROVIDER_STATUSES, 'DRAFT');
  const ssoPolicy = normalizeCode(input.ssoEnforcementPolicy || input.sso_enforcement_policy, SSO_POLICIES, 'LOCAL_ALLOWED');
  const jitPolicy = normalizeCode(input.jitPolicy || input.jit_policy, JIT_POLICIES, 'DISABLED');
  if (jitPolicy !== 'DISABLED' && authContext.approvedRole !== rbac.ROLES.PLATFORM_ADMIN) {
    throw createError('JIT enablement requires Platform Admin approval.', 403, 'JIT_PLATFORM_APPROVAL_REQUIRED');
  }

  const result = await postgres.query(`
    INSERT INTO organization_identity_providers (
      organization_id, protocol, provider_type, display_name, status, enabled,
      sso_enforcement_policy, jit_policy, issuer, client_id, secret_ref,
      secret_version, discovery_metadata, jwks_ref, saml_entity_id, saml_sso_url,
      saml_certificate_ref, saml_metadata_ref, created_by, updated_by, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13::jsonb, $14, $15, $16,
      $17, $18, $19, $19, $20::jsonb
    )
    RETURNING *
  `, [
    organizationId,
    protocol,
    providerType,
    displayName,
    status,
    input.enabled === true && status === 'ACTIVE',
    ssoPolicy,
    jitPolicy,
    cleanText(input.issuer, 500) || null,
    cleanText(input.clientId || input.client_id, 240) || null,
    assertSecretReference(input.secretRef || input.secret_ref, false),
    cleanText(input.secretVersion || input.secret_version, 80) || null,
    JSON.stringify(redactObject(input.discoveryMetadata || input.discovery_metadata || {})),
    cleanText(input.jwksRef || input.jwks_ref, 240) || null,
    cleanText(input.samlEntityId || input.saml_entity_id, 500) || null,
    cleanText(input.samlSsoUrl || input.saml_sso_url, 1000) || null,
    cleanText(input.samlCertificateRef || input.saml_certificate_ref, 240) || null,
    cleanText(input.samlMetadataRef || input.saml_metadata_ref, 240) || null,
    actorId(authContext),
    JSON.stringify(redactObject(input.metadata || {}))
  ]);
  await recordIdentityEvent({
    organizationId,
    identityProviderId: result.rows[0].id,
    eventType: 'identity_provider_created',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'success',
    metadata: { protocol, providerType, displayName }
  });
  return { ok: true, provider: providerFromRow(result.rows[0]) };
}

async function updateIdentityProvider(authContext, providerId, input = {}) {
  assertDatabase();
  const current = await getProviderRaw(providerId);
  if (!current) throw createError('Identity provider was not found.', 404, 'IDENTITY_PROVIDER_NOT_FOUND');
  const organizationId = assertOrganizationScope(authContext, current.organization_id);
  const status = normalizeCode(input.status, PROVIDER_STATUSES, current.status);
  const ssoPolicy = normalizeCode(input.ssoEnforcementPolicy || input.sso_enforcement_policy, SSO_POLICIES, current.sso_enforcement_policy);
  const jitPolicy = normalizeCode(input.jitPolicy || input.jit_policy, JIT_POLICIES, current.jit_policy);
  if (jitPolicy !== 'DISABLED' && authContext.approvedRole !== rbac.ROLES.PLATFORM_ADMIN) {
    throw createError('JIT enablement requires Platform Admin approval.', 403, 'JIT_PLATFORM_APPROVAL_REQUIRED');
  }
  const enabled = input.enabled === undefined ? current.enabled : input.enabled === true && status === 'ACTIVE';
  const result = await postgres.query(`
    UPDATE organization_identity_providers
    SET display_name = COALESCE(NULLIF($2, ''), display_name),
        status = $3,
        enabled = $4,
        sso_enforcement_policy = $5,
        jit_policy = $6,
        issuer = COALESCE(NULLIF($7, ''), issuer),
        client_id = COALESCE(NULLIF($8, ''), client_id),
        discovery_metadata = COALESCE($9::jsonb, discovery_metadata),
        jwks_ref = COALESCE(NULLIF($10, ''), jwks_ref),
        saml_entity_id = COALESCE(NULLIF($11, ''), saml_entity_id),
        saml_sso_url = COALESCE(NULLIF($12, ''), saml_sso_url),
        saml_metadata_ref = COALESCE(NULLIF($13, ''), saml_metadata_ref),
        updated_by = $14,
        updated_at = NOW()
    WHERE id = $1 AND organization_id = $15
    RETURNING *
  `, [
    current.id,
    cleanText(input.displayName || input.display_name, 160),
    status,
    enabled,
    ssoPolicy,
    jitPolicy,
    cleanText(input.issuer, 500),
    cleanText(input.clientId || input.client_id, 240),
    input.discoveryMetadata || input.discovery_metadata ? JSON.stringify(redactObject(input.discoveryMetadata || input.discovery_metadata)) : null,
    cleanText(input.jwksRef || input.jwks_ref, 240),
    cleanText(input.samlEntityId || input.saml_entity_id, 500),
    cleanText(input.samlSsoUrl || input.saml_sso_url, 1000),
    cleanText(input.samlMetadataRef || input.saml_metadata_ref, 240),
    actorId(authContext),
    organizationId
  ]);
  await recordIdentityEvent({
    organizationId,
    identityProviderId: current.id,
    eventType: 'identity_provider_updated',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'success',
    metadata: { status, enabled, ssoPolicy, jitPolicy }
  });
  return { ok: true, provider: providerFromRow(result.rows[0]) };
}

async function rotateSecretReference(authContext, providerId, input = {}) {
  assertDatabase();
  const current = await getProviderRaw(providerId);
  if (!current) throw createError('Identity provider was not found.', 404, 'IDENTITY_PROVIDER_NOT_FOUND');
  const organizationId = assertOrganizationScope(authContext, current.organization_id);
  const secretRef = assertSecretReference(input.secretRef || input.secret_ref, true);
  const result = await postgres.query(`
    UPDATE organization_identity_providers
    SET secret_ref = $2,
        secret_version = COALESCE(NULLIF($3, ''), secret_version),
        secret_rotated_at = NOW(),
        updated_by = $4,
        updated_at = NOW()
    WHERE id = $1 AND organization_id = $5
    RETURNING *
  `, [current.id, secretRef, cleanText(input.secretVersion || input.secret_version, 80), actorId(authContext), organizationId]);
  await recordIdentityEvent({
    organizationId,
    identityProviderId: current.id,
    eventType: 'identity_provider_secret_reference_rotated',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'success',
    metadata: { secretRef: '[REDACTED_REFERENCE]' }
  });
  return { ok: true, provider: providerFromRow(result.rows[0]) };
}

async function createVerifiedDomain(authContext, input = {}) {
  assertDatabase();
  const organizationId = assertOrganizationScope(authContext, input.organizationId);
  const domain = normalizeDomain(input.domain);
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw createError('A valid domain is required.', 400, 'DOMAIN_REQUIRED');
  }
  const challenge = `tsr-domain-verification=${crypto.randomBytes(24).toString('base64url')}`;
  const result = await postgres.query(`
    INSERT INTO verified_organization_domains (
      organization_id, domain, verification_state, verification_method, verification_challenge, created_by
    )
    VALUES ($1, $2, 'PENDING', $3, $4, $5)
    RETURNING *
  `, [
    organizationId,
    domain,
    normalizeCode(input.verificationMethod || input.verification_method, ['DNS_TXT', 'MANUAL_PLATFORM_REVIEW'], 'DNS_TXT'),
    challenge,
    actorId(authContext)
  ]);
  await recordIdentityEvent({
    organizationId,
    eventType: 'identity_domain_verification_created',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'pending',
    metadata: { domain }
  });
  return { ok: true, domain: domainFromRow(result.rows[0]) };
}

async function verifyDomainChallenge(authContext, domainId, input = {}) {
  assertDatabase();
  const result = await postgres.query('SELECT * FROM verified_organization_domains WHERE id = $1 LIMIT 1', [cleanText(domainId, 160)]);
  const domain = result.rows[0];
  if (!domain) throw createError('Domain verification record was not found.', 404, 'DOMAIN_NOT_FOUND');
  const organizationId = assertOrganizationScope(authContext, domain.organization_id);
  const presented = cleanText(input.challenge || input.verificationChallenge || input.verification_challenge, 500);
  if (presented !== domain.verification_challenge && authContext.approvedRole !== rbac.ROLES.PLATFORM_ADMIN) {
    throw createError('Domain verification challenge has not been proven.', 403, 'DOMAIN_VERIFICATION_NOT_PROVEN');
  }
  const updated = await postgres.query(`
    UPDATE verified_organization_domains
    SET verification_state = 'VERIFIED',
        verified_at = NOW(),
        verified_by = $2,
        updated_at = NOW()
    WHERE id = $1 AND organization_id = $3
    RETURNING *
  `, [domain.id, actorId(authContext), organizationId]);
  await recordIdentityEvent({
    organizationId,
    eventType: 'identity_domain_verified',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'success',
    metadata: { domain: domain.domain }
  });
  return { ok: true, domain: domainFromRow(updated.rows[0]) };
}

async function discoverIdentityProvider(input = {}) {
  assertDatabase();
  const domain = normalizeDomain(input.domain || String(input.email || '').split('@')[1] || '');
  const organizationSlug = cleanText(input.organizationSlug || input.organization_slug || input.organization, 160);
  if (!domain && !organizationSlug) {
    throw createError('A verified email domain or Organization login identifier is required.', 400, 'DISCOVERY_INPUT_REQUIRED');
  }
  const values = [];
  const filters = [
    "provider.enabled = true",
    "provider.status = 'ACTIVE'",
    "provider.lifecycle_status = 'ACTIVE'",
    "org.status = 'active'",
    "COALESCE(org.lifecycle_status, 'ACTIVE') = 'ACTIVE'"
  ];
  if (organizationSlug) {
    values.push(organizationSlug);
    filters.push(`org.slug = $${values.length}`);
  }
  if (domain) {
    values.push(domain);
    filters.push(`verified_domain.domain = $${values.length}`);
    filters.push("verified_domain.verification_state = 'VERIFIED'");
  }
  const result = await postgres.query(`
    SELECT provider.*
    FROM organization_identity_providers provider
    JOIN organizations org ON org.id = provider.organization_id
    LEFT JOIN verified_organization_domains verified_domain
      ON verified_domain.organization_id = provider.organization_id
    WHERE ${filters.join(' AND ')}
    ORDER BY provider.created_at
  `, values);
  if (result.rows.length > 1) {
    throw createError('SSO discovery is ambiguous. Use an explicit trusted Organization selection.', 409, 'SSO_DISCOVERY_AMBIGUOUS');
  }
  return {
    ok: true,
    provider: result.rows[0] ? providerFromRow(result.rows[0]) : null,
    matched: result.rows.length === 1
  };
}

async function createAuthenticationTransaction(input = {}) {
  assertDatabase();
  const providerId = cleanText(input.identityProviderId || input.identity_provider_id || input.providerId, 160);
  const organizationId = cleanText(input.organizationId || input.organization_id, 160);
  const provider = await getProviderRaw(providerId, organizationId);
  if (!provider || provider.enabled !== true || provider.status !== 'ACTIVE' || provider.lifecycle_status !== 'ACTIVE') {
    throw createError('Identity provider is not available for authentication.', 403, 'IDENTITY_PROVIDER_UNAVAILABLE');
  }
  const expectedProtocol = normalizeCode(input.protocol, PROTOCOLS, provider.protocol);
  if (expectedProtocol !== provider.protocol) {
    throw createError('SSO initiation protocol does not match the configured provider.', 400, 'PROTOCOL_PROVIDER_MISMATCH');
  }
  if (!await getOrganizationActive(provider.organization_id)) {
    throw createError('Organization is not active.', 403, 'ORGANIZATION_INACTIVE');
  }
  const redirectRef = cleanText(input.redirectRef || input.redirect_ref || 'admin_dashboard', 80);
  if (!SAFE_REDIRECT_REFS.includes(redirectRef)) {
    throw createError('Redirect destination is not allowlisted.', 400, 'REDIRECT_NOT_ALLOWED');
  }
  const state = crypto.randomBytes(32).toString('base64url');
  const nonce = crypto.randomBytes(32).toString('base64url');
  const pkceVerifier = provider.protocol === 'OIDC' ? crypto.randomBytes(32).toString('base64url') : null;
  const pkceChallenge = pkceVerifier
    ? crypto.createHash('sha256').update(pkceVerifier).digest('base64url')
    : null;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const result = await postgres.query(`
    INSERT INTO sso_authentication_transactions (
      organization_id, identity_provider_id, protocol, state_hash, nonce_hash,
      pkce_challenge_hash, redirect_ref, redirect_uri, expires_at, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    RETURNING *
  `, [
    provider.organization_id,
    provider.id,
    provider.protocol,
    sha256(state),
    sha256(nonce),
    pkceChallenge ? sha256(pkceChallenge) : null,
    redirectRef,
    cleanText(input.redirectUri || input.redirect_uri, 1000) || null,
    expiresAt,
    JSON.stringify({ providerVerification: 'NOT_VERIFIED', pkce: Boolean(pkceChallenge) })
  ]);
  await recordIdentityEvent({
    organizationId: provider.organization_id,
    identityProviderId: provider.id,
    eventType: 'sso_initiated',
    actorType: 'anonymous',
    actorId: 'sso-entry',
    outcome: 'pending',
    metadata: { protocol: provider.protocol, redirectRef }
  });
  return {
    ok: true,
    transactionId: result.rows[0].id,
    organizationId: provider.organization_id,
    identityProviderId: provider.id,
    protocol: provider.protocol,
    state,
    nonce,
    pkceChallenge,
    pkceMethod: pkceChallenge ? 'S256' : null,
    expiresAt
  };
}

async function consumeAuthenticationTransaction(client, input = {}) {
  const transactionId = cleanText(input.transactionId || input.transaction_id, 160);
  const state = cleanText(input.state, 240);
  const nonce = cleanText(input.nonce, 240);
  const result = await client.query(`
    SELECT *
    FROM sso_authentication_transactions
    WHERE id = $1
    FOR UPDATE
  `, [transactionId]);
  const transaction = result.rows[0];
  if (!transaction) throw createError('SSO transaction was not found.', 404, 'SSO_TRANSACTION_NOT_FOUND');
  if (transaction.status !== 'PENDING') throw createError('SSO transaction has already been used.', 409, 'SSO_TRANSACTION_REPLAY_DENIED');
  if (transaction.expires_at <= new Date()) {
    await client.query("UPDATE sso_authentication_transactions SET status = 'EXPIRED', failure_code = 'EXPIRED' WHERE id = $1", [transaction.id]);
    throw createError('SSO transaction expired.', 401, 'SSO_TRANSACTION_EXPIRED');
  }
  if (!state || sha256(state) !== transaction.state_hash) {
    await client.query("UPDATE sso_authentication_transactions SET status = 'FAILED', failure_code = 'STATE_MISMATCH' WHERE id = $1", [transaction.id]);
    throw createError('SSO state validation failed.', 403, 'SSO_STATE_MISMATCH');
  }
  if (transaction.nonce_hash && (!nonce || sha256(nonce) !== transaction.nonce_hash)) {
    await client.query("UPDATE sso_authentication_transactions SET status = 'FAILED', failure_code = 'NONCE_MISMATCH' WHERE id = $1", [transaction.id]);
    throw createError('SSO nonce validation failed.', 403, 'SSO_NONCE_MISMATCH');
  }
  return transaction;
}

async function linkFederatedIdentity(authContext, input = {}) {
  assertDatabase();
  const organizationId = assertOrganizationScope(authContext, input.organizationId);
  const provider = await getProviderRaw(input.identityProviderId || input.identity_provider_id || input.providerId, organizationId);
  if (!provider) throw createError('Identity provider was not found.', 404, 'IDENTITY_PROVIDER_NOT_FOUND');
  const externalSubject = cleanText(input.externalSubject || input.external_subject || input.subject, 500);
  const internalUserId = cleanText(input.internalUserId || input.internal_user_id, 160);
  if (!externalSubject) throw createError('Immutable external subject is required.', 400, 'EXTERNAL_SUBJECT_REQUIRED');
  if (!internalUserId) throw createError('Internal TSR user ID is required.', 400, 'INTERNAL_USER_REQUIRED');
  if (input.emailOnly === true || input.email_only === true) {
    throw createError('Email-only account linking is prohibited.', 400, 'EMAIL_ONLY_LINKING_PROHIBITED');
  }
  const userResult = await postgres.query(`
    SELECT admin_users.*, org.status AS organization_status, org.lifecycle_status AS organization_lifecycle_status
    FROM admin_users
    JOIN organizations org ON org.id = admin_users.organization_id
    WHERE admin_users.internal_user_id = $1
      AND admin_users.organization_id = $2
    LIMIT 1
  `, [internalUserId, organizationId]);
  const user = userResult.rows[0];
  if (!user || user.active !== true || (user.lifecycle_status && user.lifecycle_status !== 'ACTIVE')) {
    throw createError('Internal TSR user is not active in this Organization.', 403, 'INTERNAL_USER_NOT_ACTIVE');
  }
  if (user.organization_status !== 'active' || (user.organization_lifecycle_status && user.organization_lifecycle_status !== 'ACTIVE')) {
    throw createError('Organization is not active.', 403, 'ORGANIZATION_INACTIVE');
  }
  const result = await postgres.query(`
    INSERT INTO federated_identities (
      organization_id, identity_provider_id, internal_user_id, external_subject,
      protocol, verified_email, display_name, lifecycle_status, linked_by, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $9::jsonb)
    RETURNING *
  `, [
    organizationId,
    provider.id,
    internalUserId,
    externalSubject,
    provider.protocol,
    cleanText(input.verifiedEmail || input.verified_email, 254) || null,
    cleanText(input.displayName || input.display_name, 160) || null,
    actorId(authContext),
    JSON.stringify(redactObject(input.metadata || {}))
  ]);
  await postgres.query(`
    INSERT INTO organization_memberships (
      organization_id, subject_type, subject_id, internal_user_id, approved_role, status, source, created_by
    )
    VALUES ($1, 'ADMIN_USER', $2, $3, $4, 'ACTIVE', 'FEDERATED_LINK', $5)
    ON CONFLICT (organization_id, subject_type, subject_id) DO UPDATE SET
      internal_user_id = EXCLUDED.internal_user_id,
      approved_role = EXCLUDED.approved_role,
      status = 'ACTIVE',
      updated_at = NOW()
  `, [organizationId, user.username, internalUserId, rbac.assertApprovedRole(user.approved_role), actorId(authContext)]);
  await recordIdentityEvent({
    organizationId,
    identityProviderId: provider.id,
    federatedIdentityId: result.rows[0].id,
    eventType: 'federated_identity_linked',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'success',
    metadata: { internalUserId, externalSubjectHash: sha256(externalSubject) }
  });
  return { ok: true, federatedIdentity: federatedIdentityFromRow(result.rows[0]) };
}

async function authenticateFederatedIdentity(input = {}) {
  assertDatabase();
  return postgres.withTransaction(async (client) => {
    const transaction = await consumeAuthenticationTransaction(client, input);
    const providerResult = await client.query(`
      SELECT *
      FROM organization_identity_providers
      WHERE id = $1
        AND organization_id = $2
        AND enabled = true
        AND status = 'ACTIVE'
        AND lifecycle_status = 'ACTIVE'
      LIMIT 1
    `, [transaction.identity_provider_id, transaction.organization_id]);
    const provider = providerResult.rows[0];
    if (!provider) throw createError('Identity provider is no longer enabled.', 403, 'IDENTITY_PROVIDER_DISABLED');
    const externalSubject = cleanText(input.externalSubject || input.external_subject || input.subject, 500);
    if (!externalSubject) throw createError('Immutable external subject is required.', 400, 'EXTERNAL_SUBJECT_REQUIRED');
    const identityResult = await client.query(`
      SELECT fed.*, admin.username, admin.display_name AS admin_display_name, admin.role, admin.approved_role,
        admin.active AS admin_active, admin.lifecycle_status AS admin_lifecycle_status,
        admin.session_version, org.status AS organization_status, org.lifecycle_status AS organization_lifecycle_status,
        membership.status AS membership_status, membership.approved_role AS membership_approved_role
      FROM federated_identities fed
      JOIN admin_users admin
        ON admin.internal_user_id = fed.internal_user_id
       AND admin.organization_id = fed.organization_id
      JOIN organizations org ON org.id = fed.organization_id
      LEFT JOIN organization_memberships membership
        ON membership.organization_id = fed.organization_id
       AND membership.subject_type = 'ADMIN_USER'
       AND membership.subject_id = admin.username
      WHERE fed.identity_provider_id = $1
        AND fed.external_subject = $2
        AND fed.organization_id = $3
      LIMIT 1
      FOR UPDATE OF fed
    `, [provider.id, externalSubject, transaction.organization_id]);
    const identity = identityResult.rows[0];
    if (!identity || identity.lifecycle_status !== 'ACTIVE') {
      throw createError('Federated identity is not active.', 403, 'FEDERATED_IDENTITY_INACTIVE');
    }
    if (identity.admin_active !== true || (identity.admin_lifecycle_status && identity.admin_lifecycle_status !== 'ACTIVE')) {
      throw createError('Internal TSR user is not active.', 403, 'INTERNAL_USER_NOT_ACTIVE');
    }
    if (identity.organization_status !== 'active' || (identity.organization_lifecycle_status && identity.organization_lifecycle_status !== 'ACTIVE')) {
      throw createError('Organization is not active.', 403, 'ORGANIZATION_INACTIVE');
    }
    if (!identity.membership_status) {
      throw createError('Organization membership is required for federated access.', 403, 'MEMBERSHIP_REQUIRED');
    }
    if (identity.membership_status !== 'ACTIVE') {
      throw createError('Organization membership is not active.', 403, 'MEMBERSHIP_INACTIVE');
    }
    const approvedRole = rbac.assertApprovedRole(identity.membership_approved_role);
    if (approvedRole === rbac.ROLES.PLATFORM_ADMIN) {
      throw createError('Platform Admin cannot be granted through tenant federation.', 403, 'PLATFORM_ADMIN_FEDERATION_DENIED');
    }
    await client.query(`
      UPDATE federated_identities
      SET last_authenticated_at = NOW()
      WHERE id = $1
    `, [identity.id]);
    await client.query(`
      UPDATE sso_authentication_transactions
      SET status = 'CONSUMED', consumed_at = NOW(), consumed_by_federated_identity_id = $2
      WHERE id = $1
    `, [transaction.id, identity.id]);
    await recordIdentityEvent({
      client,
      organizationId: identity.organization_id,
      identityProviderId: provider.id,
      federatedIdentityId: identity.id,
      eventType: 'sso_success',
      actorType: 'federated_identity',
      actorId: identity.internal_user_id,
      outcome: 'success',
      metadata: { protocol: provider.protocol, providerVerification: 'LOCAL_FOUNDATION_ONLY' }
    });
    return {
      ok: true,
      providerVerification: 'NOT_PROVIDER_VERIFIED',
      sessionClaims: {
        username: identity.username,
        displayName: identity.admin_display_name || identity.username,
        organizationId: identity.organization_id,
        internalUserId: identity.internal_user_id,
        role: identity.role,
        approvedRole,
        permissions: rbac.permissionsForRole(approvedRole),
        sessionVersion: identity.session_version
      }
    };
  });
}

async function createClaimMapping(authContext, input = {}) {
  assertDatabase();
  const organizationId = assertOrganizationScope(authContext, input.organizationId);
  const provider = await getProviderRaw(input.identityProviderId || input.identity_provider_id || input.providerId, organizationId);
  if (!provider) throw createError('Identity provider was not found.', 404, 'IDENTITY_PROVIDER_NOT_FOUND');
  const targetType = normalizeCode(input.targetType || input.target_type, ['ROLE', 'PERMISSION']);
  const targetRole = targetType === 'ROLE' ? rbac.assertApprovedRole(input.targetRole || input.target_role) : null;
  if (targetRole === rbac.ROLES.PLATFORM_ADMIN) {
    throw createError('Platform Admin cannot be assigned through tenant claim mapping.', 403, 'PLATFORM_ADMIN_MAPPING_DENIED');
  }
  const targetPermission = targetType === 'PERMISSION' ? cleanText(input.targetPermission || input.target_permission, 160) : null;
  if (targetPermission && (targetPermission.startsWith('platform.') || !Object.values(rbac.PERMISSIONS).includes(targetPermission))) {
    throw createError('Unsupported or platform-scoped permission mapping.', 400, 'UNSUPPORTED_PERMISSION_MAPPING');
  }
  const claimName = cleanText(input.claimName || input.claim_name, 160);
  const claimValue = cleanText(input.claimValue || input.claim_value, 500);
  if (!claimName || !claimValue || !targetType) {
    throw createError('claimName, claimValue, and targetType are required.', 400, 'CLAIM_MAPPING_REQUIRED');
  }
  const result = await postgres.query(`
    INSERT INTO identity_claim_mappings (
      organization_id, identity_provider_id, claim_name, claim_value, target_type,
      target_role, target_permission, enabled, created_by, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
    RETURNING *
  `, [
    organizationId,
    provider.id,
    claimName,
    claimValue,
    targetType,
    targetRole,
    targetPermission,
    input.enabled !== false,
    actorId(authContext),
    JSON.stringify(redactObject(input.metadata || {}))
  ]);
  await recordIdentityEvent({
    organizationId,
    identityProviderId: provider.id,
    eventType: 'identity_claim_mapping_created',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'success',
    metadata: { claimName, targetType, targetRole, targetPermission }
  });
  return { ok: true, mapping: mappingFromRow(result.rows[0]) };
}

async function setSsoPolicy(authContext, input = {}) {
  assertDatabase();
  const organizationId = assertOrganizationScope(authContext, input.organizationId);
  const ssoPolicy = normalizeCode(input.ssoPolicyState || input.sso_policy_state, SSO_POLICIES);
  const jitPolicy = normalizeCode(input.jitPolicyState || input.jit_policy_state, JIT_POLICIES, 'DISABLED');
  if (!ssoPolicy) throw createError('A valid SSO policy state is required.', 400, 'SSO_POLICY_REQUIRED');
  if (ssoPolicy === 'SSO_REQUIRED' && authContext.approvedRole !== rbac.ROLES.PLATFORM_ADMIN) {
    throw createError('SSO_REQUIRED requires Platform Admin approval to prevent tenant lockout.', 403, 'SSO_REQUIRED_PLATFORM_APPROVAL_REQUIRED');
  }
  if (jitPolicy !== 'DISABLED' && authContext.approvedRole !== rbac.ROLES.PLATFORM_ADMIN) {
    throw createError('JIT policy enablement requires Platform Admin approval.', 403, 'JIT_PLATFORM_APPROVAL_REQUIRED');
  }
  const result = await postgres.query(`
    UPDATE organizations
    SET sso_policy_state = $2,
        sso_policy_updated_at = NOW(),
        sso_policy_updated_by = $3,
        jit_policy_state = $4,
        jit_policy_updated_at = NOW(),
        jit_policy_updated_by = $3,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, sso_policy_state, jit_policy_state
  `, [organizationId, ssoPolicy, actorId(authContext), jitPolicy]);
  await recordIdentityEvent({
    organizationId,
    eventType: 'identity_sso_policy_updated',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'success',
    metadata: { ssoPolicy, jitPolicy }
  });
  return { ok: true, policy: result.rows[0] || null };
}

async function createScimConfiguration(authContext, input = {}) {
  assertDatabase();
  const organizationId = assertOrganizationScope(authContext, input.organizationId);
  const providerId = cleanText(input.identityProviderId || input.identity_provider_id || input.providerId, 160) || null;
  if (providerId) {
    const provider = await getProviderRaw(providerId, organizationId);
    if (!provider) throw createError('Identity provider was not found.', 404, 'IDENTITY_PROVIDER_NOT_FOUND');
  }
  const credentialRef = assertSecretReference(input.credentialRef || input.credential_ref, false);
  const existing = await postgres.query(`
    SELECT id
    FROM scim_configurations
    WHERE organization_id = $1
      AND COALESCE(identity_provider_id, 'organization') = COALESCE($2, 'organization')
    LIMIT 1
  `, [organizationId, providerId]);
  const params = [
    organizationId,
    providerId,
    normalizeCode(input.status, ['DISABLED', 'ENABLED', 'SUSPENDED'], 'DISABLED'),
    credentialRef || null,
    cleanText(input.credentialVersion || input.credential_version, 80) || null,
    actorId(authContext),
    JSON.stringify(redactObject(input.metadata || {}))
  ];
  const result = existing.rows[0]
    ? await postgres.query(`
      UPDATE scim_configurations
      SET status = $3,
          credential_ref = $4,
          credential_version = $5,
          updated_by = $6,
          updated_at = NOW(),
          metadata = $7::jsonb
      WHERE id = $8 AND organization_id = $1
      RETURNING *
    `, [...params, existing.rows[0].id])
    : await postgres.query(`
      INSERT INTO scim_configurations (
        organization_id, identity_provider_id, status, credential_ref, credential_version, created_by, updated_by, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6, $7::jsonb)
      RETURNING *
    `, params);
  await recordIdentityEvent({
    organizationId,
    identityProviderId: providerId,
    eventType: 'scim_configuration_updated',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'success',
    metadata: { credentialRef: credentialRef ? '[REDACTED_REFERENCE]' : null }
  });
  return { ok: true, scimConfiguration: { ...result.rows[0], credential_ref: result.rows[0].credential_ref ? '[REDACTED_REFERENCE]' : null } };
}

async function recordScimProvisioningEvent(authContext, input = {}) {
  assertDatabase();
  const organizationId = assertOrganizationScope(authContext, input.organizationId);
  const idempotencyKey = cleanText(input.idempotencyKey || input.idempotency_key, 240);
  if (!idempotencyKey) throw createError('idempotencyKey is required.', 400, 'SCIM_IDEMPOTENCY_REQUIRED');
  const eventType = normalizeCode(input.eventType || input.event_type, ['CREATE', 'UPDATE', 'DEACTIVATE', 'REACTIVATE', 'GROUP_CHANGE']);
  if (!eventType) throw createError('A valid SCIM event type is required.', 400, 'SCIM_EVENT_TYPE_REQUIRED');
  const result = await postgres.query(`
    INSERT INTO scim_provisioning_events (
      organization_id, scim_configuration_id, identity_provider_id, external_subject,
      internal_user_id, event_type, idempotency_key, status, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'RECEIVED', $8::jsonb)
    ON CONFLICT (organization_id, idempotency_key) DO UPDATE SET
      status = scim_provisioning_events.status
    RETURNING *
  `, [
    organizationId,
    cleanText(input.scimConfigurationId || input.scim_configuration_id, 160) || null,
    cleanText(input.identityProviderId || input.identity_provider_id, 160) || null,
    cleanText(input.externalSubject || input.external_subject, 500) || null,
    cleanText(input.internalUserId || input.internal_user_id, 160) || null,
    eventType,
    idempotencyKey,
    JSON.stringify(redactObject(input.metadata || {}))
  ]);
  if (eventType === 'DEACTIVATE' && input.internalUserId) {
    await postgres.query(`
      UPDATE federated_identities
      SET lifecycle_status = 'DISABLED', disabled_at = NOW(), disabled_by = $3
      WHERE organization_id = $1 AND internal_user_id = $2 AND lifecycle_status = 'ACTIVE'
    `, [organizationId, cleanText(input.internalUserId || input.internal_user_id, 160), actorId(authContext)]);
    await postgres.query(`
      UPDATE admin_users
      SET session_version = session_version + 1, updated_at = NOW()
      WHERE organization_id = $1 AND internal_user_id = $2
    `, [organizationId, cleanText(input.internalUserId || input.internal_user_id, 160)]);
  }
  await recordIdentityEvent({
    organizationId,
    identityProviderId: cleanText(input.identityProviderId || input.identity_provider_id, 160) || null,
    eventType: eventType === 'DEACTIVATE' ? 'scim_deactivation_recorded' : 'scim_provisioning_recorded',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'recorded',
    metadata: { eventType, idempotencyKey }
  });
  return { ok: true, scimEvent: result.rows[0] };
}

async function createBreakGlassRecord(authContext, input = {}) {
  assertDatabase();
  const organizationId = input.organizationId ? assertOrganizationScope(authContext, input.organizationId) : null;
  if (authContext.approvedRole !== rbac.ROLES.PLATFORM_ADMIN && !organizationId) {
    throw createError('Organization-scoped break-glass requests require Organization context.', 403, 'ORGANIZATION_CONTEXT_REQUIRED');
  }
  const reason = cleanText(input.reason, 1000);
  if (!reason) throw createError('Break-glass reason is required.', 400, 'BREAK_GLASS_REASON_REQUIRED');
  const result = await postgres.query(`
    INSERT INTO enterprise_identity_break_glass_records (
      organization_id, actor_user_id, scope, reason, status, metadata
    )
    VALUES ($1, $2, $3, $4, 'REQUESTED', $5::jsonb)
    RETURNING *
  `, [
    organizationId,
    cleanText(input.actorUserId || input.actor_user_id || actorId(authContext), 160),
    cleanText(input.scope || 'identity_support', 160),
    reason,
    JSON.stringify(redactObject(input.metadata || {}))
  ]);
  await recordIdentityEvent({
    organizationId,
    eventType: 'break_glass_requested',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'requested',
    metadata: { scope: result.rows[0].scope }
  });
  return { ok: true, breakGlassRecord: result.rows[0] };
}

async function disableIdentityProvider(authContext, providerId, reason = '') {
  assertDatabase();
  const provider = await getProviderRaw(providerId);
  if (!provider) throw createError('Identity provider was not found.', 404, 'IDENTITY_PROVIDER_NOT_FOUND');
  const organizationId = assertOrganizationScope(authContext, provider.organization_id);
  const result = await postgres.query(`
    UPDATE organization_identity_providers
    SET enabled = false,
        status = 'DISABLED',
        disabled_at = NOW(),
        disabled_by = $2,
        updated_by = $2,
        updated_at = NOW(),
        metadata = metadata || $3::jsonb
    WHERE id = $1 AND organization_id = $4
    RETURNING *
  `, [provider.id, actorId(authContext), JSON.stringify({ disabledReason: cleanText(reason, 500) }), organizationId]);
  await postgres.query(`
    UPDATE admin_users
    SET session_version = session_version + 1, updated_at = NOW()
    WHERE organization_id = $1
      AND internal_user_id IN (
        SELECT internal_user_id
        FROM federated_identities
        WHERE identity_provider_id = $2
      )
  `, [organizationId, provider.id]);
  await recordIdentityEvent({
    organizationId,
    identityProviderId: provider.id,
    eventType: 'identity_provider_disabled',
    actorType: authContext.actorType,
    actorId: actorId(authContext),
    outcome: 'success',
    metadata: { reason: cleanText(reason, 500) }
  });
  return { ok: true, provider: providerFromRow(result.rows[0]) };
}

async function getProviderCapabilityStatus() {
  return {
    ok: true,
    foundationStatus: 'IMPLEMENTED',
    productionReady: false,
    providers: [
      'Microsoft Entra ID',
      'Okta',
      'Google Workspace / Google Identity',
      'Generic OIDC',
      'Generic SAML'
    ].map((provider) => ({
      provider,
      architecturallySupported: true,
      sourceImplemented: provider.includes('SAML') ? 'FOUNDATION_ONLY' : 'FOUNDATION_ONLY',
      locallyTested: 'FOUNDATION_ONLY',
      actualProviderVerified: false,
      productionReady: false
    }))
  };
}

module.exports = {
  createAuthenticationTransaction,
  createBreakGlassRecord,
  createClaimMapping,
  createIdentityProvider,
  createScimConfiguration,
  createVerifiedDomain,
  disableIdentityProvider,
  discoverIdentityProvider,
  getProviderCapabilityStatus,
  linkFederatedIdentity,
  listIdentityProviders,
  recordIdentityEvent,
  recordScimProvisioningEvent,
  rotateSecretReference,
  setSsoPolicy,
  updateIdentityProvider,
  verifyDomainChallenge,
  authenticateFederatedIdentity,
  redactObject
};
