const crypto = require('crypto');
const adminAuth = require('./adminAuth');
const repositories = require('../db/repositories');
const rbac = require('./rbac');
const { BOOTSTRAP_ORGANIZATION } = require('./tenantContext');

function cleanText(value, maxLength = 500) {
  return String(value || '').trim().slice(0, maxLength);
}

function getDriverApiToken() {
  return cleanText(process.env.DRIVER_API_TOKEN || process.env.TSR_DRIVER_API_TOKEN, 500);
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getPresentedToken(req) {
  const authorization = cleanText(req.get('authorization'), 600);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (match) return cleanText(match[1], 500);

  return cleanText(req.get('x-tsr-driver-token'), 500);
}

function getDriverIdentity(req) {
  if (req.driverAuth?.driverId) {
    return {
      driverId: req.driverAuth.driverId,
      driverName: req.driverAuth.driverName || req.driverAuth.driverId,
      deviceId: req.driverAuth.deviceId || null
    };
  }
  const driverId =
    cleanText(req.get('x-tsr-driver-id'), 120) ||
    cleanText(req.body?.driverId || req.body?.driver_id, 120) ||
    'driver_app';
  const driverName =
    cleanText(req.get('x-tsr-driver-name'), 160) ||
    cleanText(req.body?.driverName || req.body?.driver_name, 160) ||
    driverId;
  const deviceId =
    cleanText(req.get('x-tsr-device-id'), 160) ||
    cleanText(req.body?.deviceId || req.body?.device_id, 160) ||
    null;

  return {
    driverId,
    driverName,
    deviceId
  };
}

function isDriverAuthConfigured() {
  return repositories.isDatabaseEnabled() || Boolean(getDriverApiToken());
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

async function requireDriverAuth(req, res, next) {
  if (adminAuth.getAdminSession(req)) return next();

  const presentedToken = getPresentedToken(req);
  if (!presentedToken) {
    return res.status(401).json({
      error: 'Driver app authentication required.'
    });
  }

  try {
    if (repositories.isDatabaseEnabled()) {
      const tokenHash = hashSessionToken(presentedToken);
      const session = await repositories.getActiveDriverSession(tokenHash);
      if (session) {
        req.driverAuth = {
          authenticated: true,
          method: 'driver_session',
          tokenHash,
          sessionId: session.id,
          driverId: session.driver_id,
          legacyDriverId: session.legacy_driver_id,
          internalDriverId: session.internal_driver_id,
          organizationId: session.organization_id || BOOTSTRAP_ORGANIZATION.id,
          companyDriverNumber: session.company_driver_number || session.driver_id,
          driverName: session.driver_name,
          deviceId: session.device_id,
          expiresAt: session.expires_at,
          approvedRole: rbac.ROLES.DRIVER,
          permissions: rbac.permissionsForRole(rbac.ROLES.DRIVER)
        };
        return next();
      }
    }

    const allowLegacy = String(process.env.ALLOW_LEGACY_DRIVER_API_TOKEN || '').toLowerCase() === 'true';
    const expectedToken = getDriverApiToken();
    if (allowLegacy && expectedToken && timingSafeStringEqual(presentedToken, expectedToken)) {
      req.driverAuth = {
        authenticated: true,
        method: 'legacy_driver_api_token',
        organizationId: BOOTSTRAP_ORGANIZATION.id,
        approvedRole: rbac.ROLES.DRIVER,
        permissions: rbac.permissionsForRole(rbac.ROLES.DRIVER),
        ...getDriverIdentity(req)
      };
      return next();
    }
  } catch (error) {
    return res.status(503).json({ error: 'Driver authentication service is unavailable.' });
  }

  return res.status(401).json({
    error: 'Driver session is invalid or expired.'
  });
}

module.exports = {
  getDriverIdentity,
  getDriverApiToken,
  hashSessionToken,
  isDriverAuthConfigured,
  requireDriverAuth
};
