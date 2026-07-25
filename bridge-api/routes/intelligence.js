const express = require('express');
const authorization = require('../middleware/authorization');
const intelligenceExecution = require('../services/intelligenceExecution');
const rbac = require('../services/rbac');

const router = express.Router();

function sendError(res, error) {
  const status = error.status || 500;
  if (status >= 500) {
    console.error(`[intelligence] ${error.stack || error.message}`);
  }
  return res.status(status).json({
    error: error.message || 'Intelligence execution failed.',
    code: error.code || 'INTELLIGENCE_EXECUTION_ERROR',
    details: error.details || undefined
  });
}

function requireJson(req, res, next) {
  const contentType = String(req.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return res.status(415).json({
      error: 'Intelligence execution requires application/json.',
      code: 'INVALID_CONTENT_TYPE'
    });
  }
  return next();
}

router.get('/capabilities', authorization.requirePermission(rbac.PERMISSIONS.INTELLIGENCE_VIEW), (req, res) => {
  res.json({
    capabilities: intelligenceExecution.listCapabilities().map((capability) => ({
      id: capability.id,
      displayName: capability.displayName,
      description: capability.description,
      active: capability.active,
      version: capability.version,
      defaultExecutionProfile: capability.defaultExecutionProfile,
      allowedExecutionStrategies: capability.allowedExecutionStrategies,
      disabledReason: capability.disabledReason || null
    }))
  });
});

router.get('/status', authorization.requirePermission(rbac.PERMISSIONS.INTELLIGENCE_VIEW), (req, res) => {
  res.json({
    status: 'foundation_active',
    registeredStrategies: intelligenceExecution.listRegisteredStrategies(),
    providerAdapters: intelligenceExecution.getHostedAdapterCatalog(),
    telemetry: intelligenceExecution.telemetrySnapshot()
  });
});

router.post('/execute', requireJson, authorization.requirePermission(rbac.PERMISSIONS.INTELLIGENCE_VIEW), async (req, res) => {
  try {
    const result = await intelligenceExecution.execute(req.authContext, req.body, { req });
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;