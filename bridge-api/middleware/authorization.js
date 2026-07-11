const { BOOTSTRAP_ORGANIZATION, assertSameOrganization } = require('../services/tenantContext');
const rbac = require('../services/rbac');

function buildAuthContext(req) {
  if (req.adminSession) {
    const approvedRole = rbac.normalizeRole(req.adminSession.approvedRole || req.adminSession.role);
    return {
      authenticated: true,
      actorType: 'admin_user',
      actorId: req.adminSession.username,
      displayName: req.adminSession.displayName || req.adminSession.username,
      organizationId: req.adminSession.organizationId || (approvedRole === rbac.ROLES.PLATFORM_ADMIN ? null : BOOTSTRAP_ORGANIZATION.id),
      role: req.adminSession.role,
      approvedRole,
      permissions: req.adminSession.permissions || rbac.permissionsForRole(approvedRole),
      sessionVersion: req.adminSession.sessionVersion ?? null,
      sessionId: req.adminSession.sessionId || null
    };
  }

  if (req.driverAuth) {
    return {
      authenticated: true,
      actorType: 'driver',
      actorId: req.driverAuth.internalDriverId || req.driverAuth.driverId,
      displayName: req.driverAuth.driverName || req.driverAuth.driverId,
      organizationId: req.driverAuth.organizationId || BOOTSTRAP_ORGANIZATION.id,
      role: rbac.ROLES.DRIVER,
      approvedRole: rbac.ROLES.DRIVER,
      permissions: req.driverAuth.permissions || rbac.permissionsForRole(rbac.ROLES.DRIVER),
      sessionId: req.driverAuth.sessionId || null
    };
  }

  if (req.warehouseAuth) {
    return {
      authenticated: true,
      actorType: 'warehouse_employee',
      actorId: req.warehouseAuth.employeeId,
      displayName: req.warehouseAuth.employeeName || req.warehouseAuth.employeeId,
      organizationId: req.warehouseAuth.organizationId || BOOTSTRAP_ORGANIZATION.id,
      role: rbac.ROLES.WAREHOUSE_EMPLOYEE,
      approvedRole: rbac.ROLES.WAREHOUSE_EMPLOYEE,
      permissions: req.warehouseAuth.permissions || rbac.permissionsForRole(rbac.ROLES.WAREHOUSE_EMPLOYEE),
      sessionId: req.warehouseAuth.sessionId || null
    };
  }

  return {
    authenticated: false,
    actorType: 'anonymous',
    actorId: 'anonymous',
    organizationId: null,
    role: null,
    approvedRole: null,
    permissions: []
  };
}

function attachAuthContext(req, res, next) {
  req.authContext = buildAuthContext(req);
  return next();
}

function requireAuthentication(req, res, next) {
  req.authContext = buildAuthContext(req);
  if (!req.authContext.authenticated) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  return next();
}

function requireOrganizationContext(req, res, next) {
  req.authContext = buildAuthContext(req);
  if (!req.authContext.organizationId) {
    return res.status(403).json({ error: 'Organization context is required for this action.' });
  }
  return next();
}

function requireRole(...roles) {
  const approvedRoles = roles.map((role) => rbac.assertApprovedRole(role));
  return (req, res, next) => {
    req.authContext = buildAuthContext(req);
    if (!req.authContext.authenticated) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!approvedRoles.includes(req.authContext.approvedRole)) {
      return res.status(403).json({ error: 'Insufficient role for this action.' });
    }
    return next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    req.authContext = buildAuthContext(req);
    if (!req.authContext.authenticated) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!rbac.hasPermission(req.authContext, permission)) {
      return res.status(403).json({ error: 'Insufficient permission for this action.' });
    }
    return next();
  };
}

function requirePlatformAdmin(req, res, next) {
  return requireRole(rbac.ROLES.PLATFORM_ADMIN)(req, res, next);
}

function assertRequestOrganization(req, organizationId) {
  req.authContext = buildAuthContext(req);
  return assertSameOrganization(req.authContext.organizationId, organizationId);
}

module.exports = {
  attachAuthContext,
  assertRequestOrganization,
  buildAuthContext,
  requireAuthentication,
  requireOrganizationContext,
  requirePermission,
  requirePlatformAdmin,
  requireRole
};
