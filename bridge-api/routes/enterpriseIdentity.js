const crypto = require('crypto');
const express = require('express');
const adminAuth = require('../services/adminAuth');
const auditLog = require('../services/auditLog');
const authorization = require('../middleware/authorization');
const enterpriseIdentity = require('../services/enterpriseIdentity');
const rbac = require('../services/rbac');

const router = express.Router();

function csrfTokenForSession(session = {}) {
  const secret = adminAuth.getAdminSecret() || 'missing-admin-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${session.username || 'anonymous'}:${session.sessionVersion ?? 'legacy'}:${session.expiresAt || ''}:enterprise-identity`)
    .digest('base64url');
}

function sendError(req, res, error) {
  const status = error.status || 500;
  if (status >= 500) console.error(`[enterprise-identity] ${error.stack || error.message}`);
  return res.status(status).json({
    error: error.message || 'Unable to complete enterprise identity operation.',
    code: error.code || 'ENTERPRISE_IDENTITY_ERROR'
  });
}

function requireJsonMutation(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const contentType = String(req.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Enterprise identity mutations require application/json.', code: 'INVALID_CONTENT_TYPE' });
    }
  }
  return next();
}

function requireAdminCsrfIfCookie(req, res, next) {
  req.authContext = authorization.buildAuthContext(req);
  if (req.authContext.actorType !== 'admin_user') return next();
  const session = req.adminSession || adminAuth.getAdminSession(req) || {};
  const expected = csrfTokenForSession(session);
  const presented = String(req.get('x-tsr-admin-csrf') || '');
  if (!presented || presented !== expected) {
    auditLog.recordSecurityEvent(req, {
      eventType: 'enterprise_identity_csrf_denial',
      statusCode: 403,
      code: 'CSRF_TOKEN_INVALID'
    }).catch(() => {});
    return res.status(403).json({ error: 'Invalid admin action token.', code: 'CSRF_TOKEN_INVALID' });
  }
  return next();
}

router.post('/discover', requireJsonMutation, async (req, res) => {
  try {
    return res.json(await enterpriseIdentity.discoverIdentityProvider(req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/oidc/initiate', requireJsonMutation, async (req, res) => {
  try {
    return res.status(201).json(await enterpriseIdentity.createAuthenticationTransaction({
      ...(req.body || {}),
      protocol: 'OIDC'
    }));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/oidc/callback', requireJsonMutation, async (req, res) => {
  try {
    const result = await enterpriseIdentity.authenticateFederatedIdentity(req.body || {});
    return res.json({
      ok: true,
      providerVerification: result.providerVerification,
      sessionClaims: result.sessionClaims
    });
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/saml/acs', requireJsonMutation, async (req, res) => {
  try {
    return res.status(501).json({
      ok: false,
      code: 'SAML_RUNTIME_PROVIDER_VERIFICATION_REQUIRED',
      status: 'FOUNDATION_ONLY',
      message: 'SAML configuration, transaction, and audit foundations are implemented. Runtime assertion validation requires an approved SAML library and provider verification.'
    });
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.get('/providers', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_PROVIDER_VIEW), async (req, res) => {
  try {
    return res.json(await enterpriseIdentity.listIdentityProviders(req.authContext, req.query || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/providers', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_PROVIDER_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await enterpriseIdentity.createIdentityProvider(req.authContext, req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.patch('/providers/:id', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_PROVIDER_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await enterpriseIdentity.updateIdentityProvider(req.authContext, req.params.id, req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/providers/:id/disable', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_PROVIDER_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await enterpriseIdentity.disableIdentityProvider(req.authContext, req.params.id, req.body?.reason));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/providers/:id/rotate-secret-reference', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_PROVIDER_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await enterpriseIdentity.rotateSecretReference(req.authContext, req.params.id, req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/domains', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_DOMAIN_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await enterpriseIdentity.createVerifiedDomain(req.authContext, req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/domains/:id/verify', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_DOMAIN_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await enterpriseIdentity.verifyDomainChallenge(req.authContext, req.params.id, req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/claim-mappings', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_MAPPING_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await enterpriseIdentity.createClaimMapping(req.authContext, req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/account-links', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_ACCOUNT_LINK_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await enterpriseIdentity.linkFederatedIdentity(req.authContext, req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/sso-policy', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_SSO_POLICY_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await enterpriseIdentity.setSsoPolicy(req.authContext, req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/scim/configurations', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_SCIM_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await enterpriseIdentity.createScimConfiguration(req.authContext, req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/scim/events', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_SCIM_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await enterpriseIdentity.recordScimProvisioningEvent(req.authContext, req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/break-glass/requests', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_BREAK_GLASS_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await enterpriseIdentity.createBreakGlassRecord(req.authContext, req.body || {}));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.get('/provider-capabilities', authorization.requirePermission(rbac.PERMISSIONS.IDENTITY_AUDIT_VIEW), async (req, res) => {
  try {
    return res.json(await enterpriseIdentity.getProviderCapabilityStatus());
  } catch (error) {
    return sendError(req, res, error);
  }
});

module.exports = router;
