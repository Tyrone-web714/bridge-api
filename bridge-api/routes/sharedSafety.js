const express = require('express');
const authorization = require('../middleware/authorization');
const driverAuth = require('../services/driverAuth');
const auditLog = require('../services/auditLog');
const rbac = require('../services/rbac');
const sharedSafety = require('../services/sharedSafety');

const router = express.Router();

function hasBearerToken(req) {
  return /^Bearer\s+/i.test(String(req.get('authorization') || '')) || Boolean(req.get('x-tsr-driver-token'));
}

function hydrateDriverContextIfPresented(req, res, next) {
  if (req.adminSession || req.driverAuth || req.warehouseAuth || !hasBearerToken(req)) return next();
  return driverAuth.requireDriverAuth(req, res, () => {
    req.authContext = authorization.buildAuthContext(req);
    return next();
  });
}

function audit(req, eventType, statusCode, extra = {}) {
  auditLog.recordSecurityEvent(req, {
    eventType,
    statusCode,
    outcome: statusCode >= 200 && statusCode < 400 ? 'success' : 'failure',
    ...extra
  }).catch((error) => {
    console.warn(`shared-safety audit write failed requestId=${req.requestId || 'unknown'}: ${error.message}`);
  });
}

function sendError(req, res, error, fallbackMessage) {
  const status = error.status || 500;
  if (status === 403 && error.code === 'PLATFORM_ADMIN_REQUIRED') {
    audit(req, 'unauthorized_moderation_attempt', 403, { code: error.code });
  }
  return res.status(status).json({
    error: error.message || fallbackMessage,
    code: error.code || 'SHARED_SAFETY_ERROR'
  });
}

function requirePlatformPermission(permission) {
  return [
    authorization.requirePlatformAdmin,
    authorization.requirePermission(permission)
  ];
}

router.use(hydrateDriverContextIfPresented);

router.post(
  '/submissions',
  authorization.requirePermission(rbac.PERMISSIONS.HAZARD_SUBMIT),
  authorization.requireOrganizationContext,
  async (req, res) => {
    try {
      const result = await sharedSafety.createPrivateHazardSubmission(req.body || {}, req.authContext);
      audit(req, 'hazard_submission', 201);
      if (result.candidate) audit(req, 'nomination_for_moderation', 201);
      return res.status(201).json({
        submission: result.submission,
        moderationCandidate: result.candidate,
        message: 'Hazard submission saved as Organization-private. It is not platform-global unless sanitized and approved.'
      });
    } catch (error) {
      return sendError(req, res, error, 'Unable to create private hazard submission.');
    }
  }
);

router.get(
  '/submissions',
  authorization.requirePermission(rbac.PERMISSIONS.HAZARD_VIEW_ORGANIZATION),
  authorization.requireOrganizationContext,
  async (req, res) => {
    try {
      const submissions = await sharedSafety.listPrivateSubmissions(req.authContext, req.query || {});
      return res.json({ count: submissions.length, submissions });
    } catch (error) {
      return sendError(req, res, error, 'Unable to list private hazard submissions.');
    }
  }
);

router.post(
  '/submissions/:id/nominate',
  authorization.requirePermission(rbac.PERMISSIONS.HAZARD_REVIEW_ORGANIZATION),
  authorization.requireOrganizationContext,
  async (req, res) => {
    try {
      const candidate = await sharedSafety.nominateSubmission(req.params.id, req.authContext, req.body || {});
      audit(req, 'nomination_for_moderation', 201);
      return res.status(201).json({ candidate });
    } catch (error) {
      if (error.code === 'PRIVATE_SUBMISSION_NOT_FOUND') audit(req, 'cross_tenant_access_denial', 403, { code: error.code });
      return sendError(req, res, error, 'Unable to nominate private hazard submission.');
    }
  }
);

router.get(
  '/moderation/candidates',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_REVIEW),
  async (req, res) => {
    try {
      const candidates = await sharedSafety.listModerationCandidates(req.authContext, req.query || {});
      audit(req, 'moderation_opened', 200);
      return res.json({ count: candidates.length, candidates });
    } catch (error) {
      return sendError(req, res, error, 'Unable to list moderation candidates.');
    }
  }
);

router.put(
  '/moderation/candidates/:id/sanitize',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_REVIEW),
  async (req, res) => {
    try {
      const candidate = await sharedSafety.sanitizeCandidate(req.params.id, req.authContext, req.body || {});
      audit(req, 'sanitization_completed', 200);
      return res.json({ candidate });
    } catch (error) {
      return sendError(req, res, error, 'Unable to sanitize moderation candidate.');
    }
  }
);

router.post(
  '/moderation/candidates/:id/approve',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_APPROVE),
  authorization.requirePermission(rbac.PERMISSIONS.SHARED_SAFETY_PUBLISH),
  async (req, res) => {
    try {
      const record = await sharedSafety.approveCandidate(req.params.id, req.authContext, req.body || {});
      audit(req, 'shared_safety_approval', 201);
      audit(req, 'shared_safety_publish', 201);
      return res.status(201).json({ sharedSafetyRecord: record });
    } catch (error) {
      return sendError(req, res, error, 'Unable to approve moderation candidate.');
    }
  }
);

router.post(
  '/moderation/candidates/:id/reject',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_REJECT),
  async (req, res) => {
    try {
      const candidate = await sharedSafety.rejectCandidate(req.params.id, req.authContext, req.body || {});
      audit(req, 'shared_safety_rejection', 200);
      return res.json({ candidate });
    } catch (error) {
      return sendError(req, res, error, 'Unable to reject moderation candidate.');
    }
  }
);

router.post(
  '/moderation/candidates/:id/duplicate',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_REVIEW),
  async (req, res) => {
    try {
      const candidate = await sharedSafety.markDuplicate(req.params.id, req.authContext, req.body || {});
      audit(req, 'shared_safety_duplicate_decision', 200);
      return res.json({ candidate });
    } catch (error) {
      return sendError(req, res, error, 'Unable to mark moderation candidate as duplicate.');
    }
  }
);

router.put(
  '/records/:id/retire',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_RETIRE),
  async (req, res) => {
    try {
      const record = await sharedSafety.retireSharedRecord(req.params.id, req.authContext, req.body || {});
      audit(req, 'shared_safety_retire', 200);
      return res.json({ sharedSafetyRecord: record });
    } catch (error) {
      return sendError(req, res, error, 'Unable to retire shared safety record.');
    }
  }
);

router.get('/records', authorization.requireAuthentication, async (req, res) => {
  try {
    const records = await sharedSafety.listSharedRecords(req.query || {});
    return res.json({ count: records.length, records });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list shared safety records.');
  }
});

module.exports = router;
