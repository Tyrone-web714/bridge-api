const postgres = require('../db/postgres');
const { hashNetworkAddress } = require('../middleware/securityControls');

function cleanText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function actorFromRequest(req) {
  if (req.adminSession) {
    return {
      type: 'supervisor',
      id: cleanText(req.adminSession.username, 120) || 'unknown',
      organizationId: req.adminSession.organizationId || null,
      sessionId: req.adminSession.sessionId || null
    };
  }
  if (req.driverAuth) {
    return {
      type: 'driver',
      id: cleanText(req.driverAuth.driverId, 120) || 'unknown',
      organizationId: req.driverAuth.organizationId || null,
      sessionId: req.driverAuth.sessionId || null
    };
  }
  if (req.warehouseAuth) {
    return {
      type: 'warehouse_employee',
      id: cleanText(req.warehouseAuth.employeeId, 120) || 'unknown',
      organizationId: req.warehouseAuth.organizationId || null,
      sessionId: req.warehouseAuth.sessionId || null
    };
  }
  return {
    type: 'service',
    id: 'unattributed',
    organizationId: null,
    sessionId: null
  };
}

async function recordMutation(req, res) {
  if (!postgres.isDatabaseConfigured()) return;
  const actor = actorFromRequest(req);
  await postgres.query(
    `INSERT INTO audit_events (
      request_id, actor_type, actor_id, organization_id, method, path, status_code,
      network_hash, event_type, outcome, session_id, metadata, occurred_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'api_mutation', $9, $10, $11::jsonb, NOW())`,
    [
      cleanText(req.requestId, 120) || null,
      actor.type,
      actor.id,
      actor.organizationId,
      cleanText(req.method, 12),
      cleanText(req.originalUrl?.split('?')[0], 500),
      res.statusCode,
      hashNetworkAddress(req),
      res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure',
      actor.sessionId,
      JSON.stringify({
        approvedRole: req.authContext?.approvedRole || req.adminSession?.approvedRole || req.driverAuth?.approvedRole || req.warehouseAuth?.approvedRole || null
      })
    ]
  );
}

function mutationAuditMiddleware(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      recordMutation(req, res).catch((error) => {
        console.warn(`audit log write failed requestId=${req.requestId || 'unknown'}: ${error.message}`);
      });
    }
  });
  return next();
}

module.exports = {
  mutationAuditMiddleware,
  recordMutation
};
