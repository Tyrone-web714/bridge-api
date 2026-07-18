const crypto = require('crypto');
const express = require('express');
const adminAuth = require('../services/adminAuth');
const auditLog = require('../services/auditLog');
const authorization = require('../middleware/authorization');
const dataLifecycle = require('../services/dataLifecycle');
const rbac = require('../services/rbac');

const router = express.Router();

function csrfTokenForSession(session = {}) {
  const secret = adminAuth.getAdminSecret() || 'missing-admin-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${session.username || 'anonymous'}:${session.sessionVersion ?? 'legacy'}:${session.expiresAt || ''}:data-lifecycle`)
    .digest('base64url');
}

function sendError(req, res, error) {
  const status = error.status || 500;
  if (status >= 500) console.error(`[data-lifecycle] ${error.stack || error.message}`);
  return res.status(status).json({
    error: error.message || 'Unable to complete lifecycle operation.',
    code: error.code || 'DATA_LIFECYCLE_ERROR'
  });
}

function requireJsonMutation(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const contentType = String(req.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Lifecycle mutations require application/json.', code: 'INVALID_CONTENT_TYPE' });
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
      eventType: 'data_lifecycle_csrf_denial',
      statusCode: 403,
      code: 'CSRF_TOKEN_INVALID'
    }).catch(() => {});
    return res.status(403).json({ error: 'Invalid admin action token.', code: 'CSRF_TOKEN_INVALID' });
  }
  return next();
}

router.get('/policy/:dataClass', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_DSR_MANAGE), async (req, res) => {
  try {
    const policy = await dataLifecycle.getLifecyclePolicy(req.params.dataClass, req.authContext.organizationId);
    return res.json({ ok: true, policy });
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/users/deactivate', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_USER_DEACTIVATE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await dataLifecycle.deactivateUser(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/users/reactivate', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_USER_REACTIVATE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await dataLifecycle.reactivateUser(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/users/deletion-requests', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_USER_REQUEST_DELETE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await dataLifecycle.requestUserDeletion(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/users/deletion-requests/:id/cancel', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_USER_REVIEW_DELETE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await dataLifecycle.cancelDeletionRequest(req.authContext, req.params.id));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/users/purge-preview', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_USER_REVIEW_DELETE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await dataLifecycle.previewUserPurgeImpact(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/users/anonymize', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_USER_REVIEW_DELETE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await dataLifecycle.anonymizeUser(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/legal-holds', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_LEGAL_HOLD_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await dataLifecycle.applyLegalHold(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/legal-holds/:id/release', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_LEGAL_HOLD_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await dataLifecycle.releaseLegalHold(req.authContext, req.params.id, req.body?.reason));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/organizations/termination-requests', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_ORGANIZATION_TERMINATE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await dataLifecycle.requestOrganizationTermination(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/organizations/purge-preview', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_ORGANIZATION_REVIEW), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await dataLifecycle.previewOrganizationPurgeImpact(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/exports', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_EXPORT), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await dataLifecycle.createDataExportRequest(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/data-subject-requests', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_DSR_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.status(201).json(await dataLifecycle.submitDataSubjectRequest(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/data-subject-requests/:id/review', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_DSR_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await dataLifecycle.reviewDataSubjectRequest(req.authContext, req.params.id, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/purge/ephemeral-preview', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_USER_REVIEW_DELETE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await dataLifecycle.previewEphemeralPurge(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

router.post('/purge/ephemeral-execute', authorization.requirePermission(rbac.PERMISSIONS.LIFECYCLE_USER_PURGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    return res.json(await dataLifecycle.executeEphemeralPurge(req.authContext, req.body));
  } catch (error) {
    return sendError(req, res, error);
  }
});

module.exports = router;
