const postgres = require('../db/postgres');
const { hashNetworkAddress } = require('../middleware/securityControls');

function cleanText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function actorFromRequest(req) {
  if (req.adminSession) {
    return {
      type: 'supervisor',
      id: cleanText(req.adminSession.username, 120) || 'unknown'
    };
  }
  if (req.driverAuth) {
    return {
      type: 'driver',
      id: cleanText(req.driverAuth.driverId, 120) || 'unknown'
    };
  }
  return {
    type: 'service',
    id: 'unattributed'
  };
}

async function recordMutation(req, res) {
  if (!postgres.isDatabaseConfigured()) return;
  const actor = actorFromRequest(req);
  await postgres.query(
    `INSERT INTO audit_events (
      request_id, actor_type, actor_id, method, path, status_code, network_hash, occurred_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [
      cleanText(req.requestId, 120) || null,
      actor.type,
      actor.id,
      cleanText(req.method, 12),
      cleanText(req.originalUrl?.split('?')[0], 500),
      res.statusCode,
      hashNetworkAddress(req)
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
