const crypto = require('crypto');
const express = require('express');
const adminAuth = require('../services/adminAuth');
const driverAuth = require('../services/driverAuth');
const repositories = require('../db/repositories');

const router = express.Router();
const SESSION_HOURS = Math.min(
  Math.max(Number.parseInt(process.env.DRIVER_SESSION_HOURS, 10) || 16, 1),
  24
);

function cleanText(value, maxLength = 160) {
  return String(value || '').trim().slice(0, maxLength);
}

router.post('/login', async (req, res) => {
  try {
    if (!repositories.isDatabaseEnabled()) {
      return res.status(503).json({ error: 'Driver sessions require PostgreSQL.' });
    }

    const driverId = cleanText(req.body?.driverId || req.body?.driver_id, 120);
    const pin = String(req.body?.pin || '');
    const deviceId = cleanText(req.body?.deviceId || req.body?.device_id, 160);
    const organizationRealm = cleanText(
      req.body?.organizationSlug || req.body?.organization_slug || req.body?.organizationCode || req.body?.organization_code,
      160
    );
    if (!driverId || !pin || !deviceId) {
      return res.status(400).json({ error: 'Driver ID, PIN, and device ID are required.' });
    }

    const organization = organizationRealm ? await repositories.getOrganization(organizationRealm) : null;
    if (organizationRealm && !organization) {
      return res.status(401).json({ error: 'Driver ID or PIN is invalid.' });
    }
    const driver = await repositories.getDriverAuthRecord(driverId, organization ? { organizationId: organization.id } : {});
    if (!driver || !driver.pin_hash || !adminAuth.verifyPassword(pin, driver.pin_hash)) {
      return res.status(401).json({ error: 'Driver ID or PIN is invalid.' });
    }
    if (driver.active !== true) {
      return res.status(403).json({
        error: 'Driver ID is inactive. A supervisor must activate the driver before login.',
        code: 'DRIVER_INACTIVE'
      });
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = driverAuth.hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
    await repositories.createDriverSession({
      id: crypto.randomUUID(),
      driverId,
      organizationId: driver.organization_id,
      internalDriverId: driver.internal_driver_id,
      deviceId,
      tokenHash,
      expiresAt
    });

    return res.json({
      ok: true,
      token,
      expiresAt,
      driver: {
        driverId: driver.company_driver_number || driver.driver_id,
        companyDriverNumber: driver.company_driver_number || driver.driver_id,
        internalDriverId: driver.internal_driver_id || driver.driver_id,
        organizationId: driver.organization_id || null,
        driverName: driver.driver_name
      }
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to create driver session.'
    });
  }
});

router.post('/logout', driverAuth.requireDriverAuth, async (req, res) => {
  try {
    if (req.driverAuth?.tokenHash) {
      await repositories.revokeDriverSession(req.driverAuth.tokenHash);
    }
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to end driver session.' });
  }
});

router.get('/session', driverAuth.requireDriverAuth, (req, res) => {
  return res.json({
    ok: true,
    driver: {
      driverId: req.driverAuth.driverId,
      companyDriverNumber: req.driverAuth.companyDriverNumber || req.driverAuth.driverId,
      internalDriverId: req.driverAuth.internalDriverId || null,
      organizationId: req.driverAuth.organizationId || null,
      driverName: req.driverAuth.driverName
    },
    deviceId: req.driverAuth.deviceId,
    expiresAt: req.driverAuth.expiresAt
  });
});

module.exports = router;
