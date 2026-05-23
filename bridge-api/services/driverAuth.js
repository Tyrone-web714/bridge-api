const crypto = require('crypto');
const adminAuth = require('./adminAuth');

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
  const headerToken = cleanText(req.get('x-tsr-driver-token'), 500);
  if (headerToken) return headerToken;

  const authorization = cleanText(req.get('authorization'), 600);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? cleanText(match[1], 500) : '';
}

function getDriverIdentity(req) {
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
  return Boolean(getDriverApiToken());
}

function requireDriverAuth(req, res, next) {
  if (adminAuth.getAdminSession(req)) return next();

  const expectedToken = getDriverApiToken();
  if (!expectedToken) return next();

  const presentedToken = getPresentedToken(req);
  if (!presentedToken || !timingSafeStringEqual(presentedToken, expectedToken)) {
    return res.status(401).json({
      error: 'Driver app authentication required.'
    });
  }

  req.driverAuth = {
    authenticated: true,
    method: 'driver_api_token',
    ...getDriverIdentity(req)
  };
  return next();
}

module.exports = {
  getDriverIdentity,
  getDriverApiToken,
  isDriverAuthConfigured,
  requireDriverAuth
};
