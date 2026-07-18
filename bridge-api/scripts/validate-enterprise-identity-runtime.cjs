require('dotenv').config();

const crypto = require('crypto');
const postgres = require('../db/postgres');
const enterpriseIdentity = require('../services/enterpriseIdentity');
const rbac = require('../services/rbac');

function assert(condition, message) {
  if (!condition) throw new Error(`[enterprise-identity-runtime] ${message}`);
}

function context(overrides = {}) {
  const role = overrides.approvedRole || rbac.ROLES.ORGANIZATION_ADMIN;
  return {
    authenticated: true,
    actorType: 'admin_user',
    actorId: overrides.actorId || 'identity-runtime-admin',
    organizationId: overrides.organizationId || 'identity-runtime-org-a',
    approvedRole: role,
    role,
    permissions: rbac.permissionsForRole(role),
    ...overrides
  };
}

async function seedOrganization(id, name) {
  await postgres.query(`
    INSERT INTO organizations (id, name, slug, status, lifecycle_status)
    VALUES ($1, $2, $1, 'active', 'ACTIVE')
    ON CONFLICT (id) DO UPDATE SET
      status = 'active',
      lifecycle_status = 'ACTIVE',
      sso_policy_state = 'LOCAL_ALLOWED',
      jit_policy_state = 'DISABLED',
      updated_at = NOW()
  `, [id, name]);
}

async function seedAdminUser(organizationId, username, internalUserId, approvedRole = rbac.ROLES.SUPERVISOR) {
  await postgres.query(`
    INSERT INTO admin_users (
      username, organization_id, internal_user_id, password_hash, role, approved_role,
      display_name, active, lifecycle_status, session_version
    )
    VALUES ($1, $2, $3, 'not-used', 'supervisor', $4, $5, true, 'ACTIVE', 1)
    ON CONFLICT (username) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      internal_user_id = EXCLUDED.internal_user_id,
      approved_role = EXCLUDED.approved_role,
      active = true,
      lifecycle_status = 'ACTIVE',
      session_version = admin_users.session_version + 1,
      updated_at = NOW()
  `, [username, organizationId, internalUserId, approvedRole, `Runtime ${username}`]);
}

async function main() {
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required');
  assert(/127\.0\.0\.1:5544\d/.test(process.env.DATABASE_URL), 'runtime validation must use isolated local PostgreSQL on a 5544x validation port');

  const runId = `identity-${Date.now()}`;
  const orgA = `${runId}-org-a`;
  const orgB = `${runId}-org-b`;
  const userA = `${runId}-user-a`;
  const usernameA = `${runId}-supervisor-a`;
  const externalSubject = `sub-${crypto.randomUUID()}`;

  await seedOrganization(orgA, 'Identity Runtime A');
  await seedOrganization(orgB, 'Identity Runtime B');
  await seedAdminUser(orgA, usernameA, userA, rbac.ROLES.SUPERVISOR);

  const orgAdminA = context({ organizationId: orgA, actorId: `${runId}-org-admin-a` });
  const orgAdminB = context({ organizationId: orgB, actorId: `${runId}-org-admin-b` });
  const platformAdmin = context({ organizationId: null, actorId: `${runId}-platform`, approvedRole: rbac.ROLES.PLATFORM_ADMIN });

  const providerResult = await enterpriseIdentity.createIdentityProvider(orgAdminA, {
    organizationId: orgA,
    protocol: 'OIDC',
    providerType: 'GENERIC_OIDC',
    displayName: `${runId} OIDC`,
    status: 'ACTIVE',
    enabled: true,
    issuer: `https://idp.example.test/${runId}`,
    clientId: `${runId}-client`,
    secretRef: `secret://tsr/${runId}/oidc-client`,
    discoveryMetadata: {
      authorization_endpoint: `https://idp.example.test/${runId}/authorize`,
      token_endpoint: `https://idp.example.test/${runId}/token`
    }
  });
  const provider = providerResult.provider;
  assert(provider.enabled === true, 'provider must be enabled');
  assert(provider.secretRef === '[REDACTED_REFERENCE]', 'provider secret reference must be redacted');
  assert(!JSON.stringify(provider).includes('secret://tsr'), 'provider response must not expose raw secret references');

  let rawSecretRejected = false;
  try {
    await enterpriseIdentity.rotateSecretReference(orgAdminA, provider.id, {
      secretRef: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });
  } catch (error) {
    rawSecretRejected = error.code === 'RAW_SECRET_REJECTED';
  }
  assert(rawSecretRejected, 'raw-looking secret values must be rejected');

  let crossTenantBlocked = false;
  try {
    await enterpriseIdentity.listIdentityProviders(orgAdminA, { organizationId: orgB });
  } catch (error) {
    crossTenantBlocked = error.code === 'TENANT_ISOLATION_VIOLATION' || error.status === 403;
  }
  assert(crossTenantBlocked, 'Org A must not list Org B IdP configuration');

  let jitBlocked = false;
  try {
    await enterpriseIdentity.updateIdentityProvider(orgAdminA, provider.id, { jitPolicy: 'MINIMUM_ACCESS' });
  } catch (error) {
    jitBlocked = error.code === 'JIT_PLATFORM_APPROVAL_REQUIRED';
  }
  assert(jitBlocked, 'JIT enablement must require Platform Admin approval');

  let platformMappingBlocked = false;
  try {
    await enterpriseIdentity.createClaimMapping(orgAdminA, {
      organizationId: orgA,
      identityProviderId: provider.id,
      claimName: 'groups',
      claimValue: 'admins',
      targetType: 'ROLE',
      targetRole: 'PLATFORM_ADMIN'
    });
  } catch (error) {
    platformMappingBlocked = error.code === 'PLATFORM_ADMIN_MAPPING_DENIED' || error.code === 'UNSUPPORTED_ROLE';
  }
  assert(platformMappingBlocked, 'tenant claim mapping must not grant Platform Admin');

  const mapping = await enterpriseIdentity.createClaimMapping(orgAdminA, {
    organizationId: orgA,
    identityProviderId: provider.id,
    claimName: 'groups',
    claimValue: 'route-supervisors',
    targetType: 'ROLE',
    targetRole: 'SUPERVISOR'
  });
  assert(mapping.mapping.targetRole === 'SUPERVISOR', 'approved claim mapping must be recorded');

  let emailOnlyBlocked = false;
  try {
    await enterpriseIdentity.linkFederatedIdentity(orgAdminA, {
      organizationId: orgA,
      identityProviderId: provider.id,
      internalUserId: userA,
      externalSubject,
      verifiedEmail: `${usernameA}@example.test`,
      emailOnly: true
    });
  } catch (error) {
    emailOnlyBlocked = error.code === 'EMAIL_ONLY_LINKING_PROHIBITED';
  }
  assert(emailOnlyBlocked, 'email-only account linking must be prohibited');

  const linked = await enterpriseIdentity.linkFederatedIdentity(orgAdminA, {
    organizationId: orgA,
    identityProviderId: provider.id,
    internalUserId: userA,
    externalSubject,
    verifiedEmail: `${usernameA}@example.test`,
    displayName: 'Runtime Supervisor A',
    metadata: { proof: 'runtime-controlled-existing-session' }
  });
  assert(linked.federatedIdentity.externalSubject === externalSubject, 'federated identity must use immutable external subject');

  let duplicateSubjectBlocked = false;
  try {
    await enterpriseIdentity.linkFederatedIdentity(orgAdminA, {
      organizationId: orgA,
      identityProviderId: provider.id,
      internalUserId: userA,
      externalSubject,
      metadata: { proof: 'duplicate' }
    });
  } catch (error) {
    duplicateSubjectBlocked = /duplicate key|unique/i.test(error.message);
  }
  assert(duplicateSubjectBlocked, 'provider subject mapping must be unique');

  const domain = await enterpriseIdentity.createVerifiedDomain(orgAdminA, {
    organizationId: orgA,
    domain: `${runId}.example.test`
  });
  const discoverBeforeVerify = await enterpriseIdentity.discoverIdentityProvider({ domain: `${runId}.example.test` });
  assert(discoverBeforeVerify.matched === false, 'unverified domain must not be authoritative');
  await enterpriseIdentity.verifyDomainChallenge(orgAdminA, domain.domain.id, {
    challenge: domain.domain.verificationChallenge
  });
  const discoverAfterVerify = await enterpriseIdentity.discoverIdentityProvider({ email: `user@${runId}.example.test` });
  assert(discoverAfterVerify.matched === true && discoverAfterVerify.provider.id === provider.id, 'verified domain discovery must find exactly one provider');

  const transaction = await enterpriseIdentity.createAuthenticationTransaction({
    organizationId: orgA,
    identityProviderId: provider.id,
    protocol: 'OIDC',
    redirectRef: 'admin_dashboard'
  });
  assert(transaction.state && transaction.nonce && transaction.pkceChallenge, 'OIDC transaction must include state, nonce, and PKCE challenge');

  let stateMismatchBlocked = false;
  try {
    await enterpriseIdentity.authenticateFederatedIdentity({
      transactionId: transaction.transactionId,
      state: 'wrong-state',
      nonce: transaction.nonce,
      externalSubject
    });
  } catch (error) {
    stateMismatchBlocked = error.code === 'SSO_STATE_MISMATCH';
  }
  assert(stateMismatchBlocked, 'state mismatch must be rejected');

  const secondTransaction = await enterpriseIdentity.createAuthenticationTransaction({
    organizationId: orgA,
    identityProviderId: provider.id,
    protocol: 'OIDC',
    redirectRef: 'admin_dashboard'
  });
  const authResult = await enterpriseIdentity.authenticateFederatedIdentity({
    transactionId: secondTransaction.transactionId,
    state: secondTransaction.state,
    nonce: secondTransaction.nonce,
    externalSubject
  });
  assert(authResult.sessionClaims.organizationId === orgA, 'federated login must rebuild Organization context from TSR records');
  assert(authResult.sessionClaims.internalUserId === userA, 'federated login must resolve internal TSR user');
  assert(authResult.sessionClaims.approvedRole === rbac.ROLES.SUPERVISOR, 'federated login must rebuild approved TSR role');
  assert(authResult.providerVerification === 'NOT_PROVIDER_VERIFIED', 'runtime fixture must not claim provider verification');

  let replayBlocked = false;
  try {
    await enterpriseIdentity.authenticateFederatedIdentity({
      transactionId: secondTransaction.transactionId,
      state: secondTransaction.state,
      nonce: secondTransaction.nonce,
      externalSubject
    });
  } catch (error) {
    replayBlocked = error.code === 'SSO_TRANSACTION_REPLAY_DENIED';
  }
  assert(replayBlocked, 'SSO transaction replay must be denied');

  await postgres.query(`
    UPDATE organization_memberships
    SET status = 'REVOKED', revoked_at = NOW(), revoked_by = 'runtime-validation'
    WHERE organization_id = $1 AND subject_type = 'ADMIN_USER' AND subject_id = $2
  `, [orgA, usernameA]);
  const revokedMembershipTransaction = await enterpriseIdentity.createAuthenticationTransaction({
    organizationId: orgA,
    identityProviderId: provider.id,
    protocol: 'OIDC',
    redirectRef: 'admin_dashboard'
  });
  let revokedMembershipBlocked = false;
  try {
    await enterpriseIdentity.authenticateFederatedIdentity({
      transactionId: revokedMembershipTransaction.transactionId,
      state: revokedMembershipTransaction.state,
      nonce: revokedMembershipTransaction.nonce,
      externalSubject
    });
  } catch (error) {
    revokedMembershipBlocked = error.code === 'MEMBERSHIP_INACTIVE';
  }
  assert(revokedMembershipBlocked, 'revoked Organization membership must block federated access');
  await postgres.query(`
    UPDATE organization_memberships
    SET status = 'ACTIVE', revoked_at = NULL, revoked_by = NULL
    WHERE organization_id = $1 AND subject_type = 'ADMIN_USER' AND subject_id = $2
  `, [orgA, usernameA]);

  await postgres.query(`
    DELETE FROM organization_memberships
    WHERE organization_id = $1 AND subject_type = 'ADMIN_USER' AND subject_id = $2
  `, [orgA, usernameA]);
  const missingMembershipTransaction = await enterpriseIdentity.createAuthenticationTransaction({
    organizationId: orgA,
    identityProviderId: provider.id,
    protocol: 'OIDC',
    redirectRef: 'admin_dashboard'
  });
  let missingMembershipBlocked = false;
  try {
    await enterpriseIdentity.authenticateFederatedIdentity({
      transactionId: missingMembershipTransaction.transactionId,
      state: missingMembershipTransaction.state,
      nonce: missingMembershipTransaction.nonce,
      externalSubject
    });
  } catch (error) {
    missingMembershipBlocked = error.code === 'MEMBERSHIP_REQUIRED';
  }
  assert(missingMembershipBlocked, 'missing Organization membership must block federated access');
  await postgres.query(`
    INSERT INTO organization_memberships (
      organization_id, subject_type, subject_id, internal_user_id, approved_role, status, source, created_by
    )
    VALUES ($1, 'ADMIN_USER', $2, $3, 'SUPERVISOR', 'ACTIVE', 'RUNTIME_RESTORE', 'runtime-validation')
  `, [orgA, usernameA, userA]);

  await enterpriseIdentity.recordScimProvisioningEvent(orgAdminA, {
    organizationId: orgA,
    identityProviderId: provider.id,
    internalUserId: userA,
    externalSubject,
    eventType: 'DEACTIVATE',
    idempotencyKey: `${runId}-scim-deactivate`
  });
  const thirdTransaction = await enterpriseIdentity.createAuthenticationTransaction({
    organizationId: orgA,
    identityProviderId: provider.id,
    protocol: 'OIDC',
    redirectRef: 'admin_dashboard'
  });
  let deactivatedIdentityBlocked = false;
  try {
    await enterpriseIdentity.authenticateFederatedIdentity({
      transactionId: thirdTransaction.transactionId,
      state: thirdTransaction.state,
      nonce: thirdTransaction.nonce,
      externalSubject
    });
  } catch (error) {
    deactivatedIdentityBlocked = error.code === 'FEDERATED_IDENTITY_INACTIVE';
  }
  assert(deactivatedIdentityBlocked, 'SCIM deactivation must block federated access without deleting history');

  const providerB = await enterpriseIdentity.createIdentityProvider(orgAdminB, {
    organizationId: orgB,
    protocol: 'OIDC',
    providerType: 'GENERIC_OIDC',
    displayName: `${runId} OIDC B`,
    status: 'ACTIVE',
    enabled: true,
    issuer: `https://idp-b.example.test/${runId}`,
    clientId: `${runId}-client-b`
  });
  let providerMixupBlocked = false;
  try {
    await enterpriseIdentity.createAuthenticationTransaction({
      organizationId: orgA,
      identityProviderId: providerB.provider.id,
      protocol: 'OIDC',
      redirectRef: 'admin_dashboard'
    });
  } catch (error) {
    providerMixupBlocked = error.code === 'IDENTITY_PROVIDER_UNAVAILABLE' || error.code === 'IDENTITY_PROVIDER_NOT_FOUND';
  }
  assert(providerMixupBlocked, 'Org A must not initiate SSO against Org B provider');

  let ssoRequiredBlocked = false;
  try {
    await enterpriseIdentity.setSsoPolicy(orgAdminA, {
      organizationId: orgA,
      ssoPolicyState: 'SSO_REQUIRED'
    });
  } catch (error) {
    ssoRequiredBlocked = error.code === 'SSO_REQUIRED_PLATFORM_APPROVAL_REQUIRED';
  }
  assert(ssoRequiredBlocked, 'SSO_REQUIRED must be protected against accidental tenant lockout');
  await enterpriseIdentity.setSsoPolicy(platformAdmin, {
    organizationId: orgA,
    ssoPolicyState: 'SSO_OPTIONAL',
    jitPolicyState: 'DISABLED'
  });

  let rawScimCredentialRejected = false;
  try {
    await enterpriseIdentity.createScimConfiguration(orgAdminA, {
      organizationId: orgA,
      identityProviderId: provider.id,
      status: 'ENABLED',
      credentialRef: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    });
  } catch (error) {
    rawScimCredentialRejected = error.code === 'RAW_SECRET_REJECTED';
  }
  assert(rawScimCredentialRejected, 'SCIM raw-looking credential values must be rejected');

  const scimConfig = await enterpriseIdentity.createScimConfiguration(orgAdminA, {
    organizationId: orgA,
    identityProviderId: provider.id,
    status: 'ENABLED',
    credentialRef: `secret://tsr/${runId}/scim-token`
  });
  assert(scimConfig.scimConfiguration.credential_ref === '[REDACTED_REFERENCE]', 'SCIM credential reference must be redacted');

  const breakGlass = await enterpriseIdentity.createBreakGlassRecord(orgAdminA, {
    organizationId: orgA,
    reason: 'runtime validation of audited break-glass request',
    scope: 'identity_support'
  });
  assert(breakGlass.breakGlassRecord.status === 'REQUESTED', 'break-glass must start as explicit requested access, not a bypass');

  const capabilities = await enterpriseIdentity.getProviderCapabilityStatus();
  assert(capabilities.productionReady === false, 'foundation must not be marked production ready');
  assert(capabilities.providers.every((item) => item.actualProviderVerified === false), 'providers must remain unverified');

  const events = await postgres.query(`
    SELECT metadata::text AS metadata
    FROM identity_security_events
    WHERE organization_id IN ($1, $2)
  `, [orgA, orgB]);
  assert(!events.rows.some((row) => /secret:\/\/tsr|aaaaaaaaaaaaaaaa/i.test(row.metadata)), 'identity audit events must not contain raw secrets');

  console.log('[enterprise-identity-runtime] isolated database enterprise identity checks passed');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
