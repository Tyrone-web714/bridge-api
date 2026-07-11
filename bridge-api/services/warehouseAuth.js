const crypto = require('crypto');
const adminAuth = require('./adminAuth');
const repositories = require('../db/repositories');
const rbac = require('./rbac');
const { BOOTSTRAP_ORGANIZATION } = require('./tenantContext');

function cleanText(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getPresentedToken(req) {
  const authorization = cleanText(req.get('authorization'), 600);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (match) return cleanText(match[1], 500);
  return cleanText(req.get('x-tsr-warehouse-token'), 500);
}

async function authenticateWarehouseEmployee(employeeIdValue, pinValue, options = {}) {
  const employeeId = cleanText(employeeIdValue, 120);
  const pin = String(pinValue || '');
  if (!employeeId || !pin) {
    const error = new Error('Warehouse employee ID and PIN are required.');
    error.status = 400;
    error.code = 'WAREHOUSE_AUTH_REQUIRED';
    throw error;
  }

  const employee = await repositories.getWarehouseEmployeeWithPin(employeeId, options);
  if (!employee || employee.active !== true || !employee.pin_hash || !adminAuth.verifyPassword(pin, employee.pin_hash)) {
    const error = new Error('Warehouse employee ID or PIN is invalid, or the employee is inactive.');
    error.status = 401;
    error.code = 'WAREHOUSE_AUTH_INVALID';
    throw error;
  }

  return {
    ...employee,
    organization_id: employee.organization_id || BOOTSTRAP_ORGANIZATION.id,
    approvedRole: rbac.ROLES.WAREHOUSE_EMPLOYEE,
    permissions: rbac.permissionsForRole(rbac.ROLES.WAREHOUSE_EMPLOYEE)
  };
}

async function createWarehouseSession(employee, options = {}) {
  if (!repositories.createWarehouseEmployeeSession) return null;
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + (Number(options.sessionMs) || 8 * 60 * 60 * 1000)).toISOString();
  await repositories.createWarehouseEmployeeSession({
    id: crypto.randomUUID(),
    employeeId: employee.employee_id,
    organizationId: employee.organization_id || BOOTSTRAP_ORGANIZATION.id,
    tokenHash: hashSessionToken(token),
    expiresAt
  });
  return { token, expiresAt };
}

async function requireWarehouseAuth(req, res, next) {
  const token = getPresentedToken(req);
  if (!token || !repositories.getActiveWarehouseEmployeeSession) {
    return res.status(401).json({ error: 'Warehouse authentication required.' });
  }
  const session = await repositories.getActiveWarehouseEmployeeSession(hashSessionToken(token));
  if (!session) {
    return res.status(401).json({ error: 'Warehouse session is invalid or expired.' });
  }
  req.warehouseAuth = {
    authenticated: true,
    method: 'warehouse_session',
    sessionId: session.id,
    employeeId: session.employee_id,
    companyEmployeeId: session.company_employee_id || session.employee_id,
    employeeName: session.employee_name,
    organizationId: session.organization_id || BOOTSTRAP_ORGANIZATION.id,
    approvedRole: rbac.ROLES.WAREHOUSE_EMPLOYEE,
    permissions: rbac.permissionsForRole(rbac.ROLES.WAREHOUSE_EMPLOYEE),
    expiresAt: session.expires_at
  };
  return next();
}

module.exports = {
  authenticateWarehouseEmployee,
  createWarehouseSession,
  hashSessionToken,
  requireWarehouseAuth
};
