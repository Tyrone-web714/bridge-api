const { BOOTSTRAP_ORGANIZATION, assertSameOrganization } = require('../services/tenantContext');
const auditLog = require('../services/auditLog');
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

function isPublicPath(req) {
  const path = String(req.originalUrl || req.path || '').split('?')[0].replace(/\/+$/, '') || '/';
  return path === '/health'
    || path === '/ready'
    || path === '/api/driver-auth/login'
    || path === '/api/enterprise-identity/discover'
    || path === '/api/enterprise-identity/oidc/initiate'
    || path === '/api/enterprise-identity/oidc/callback'
    || path === '/api/enterprise-identity/saml/acs'
    || path === '/api/routing/manual-hazards/admin/login';
}

function isAdminHtmlRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET') return false;

  const path = String(req.originalUrl || req.path || '').split('?')[0].replace(/\/+$/, '') || '/';
  if (!path.startsWith('/api/')) return false;
  if (path === '/api/routing/manual-hazards/admin/login') return false;

  return path === '/api/admin'
    || path.endsWith('/admin')
    || path.endsWith('/admin-users/admin')
    || path.startsWith('/api/account-intelligence/insights/admin');
}

function deny(req, res, status, code, message) {
  req.authorizationDenied = {
    code,
    message,
    organizationId: req.authContext?.organizationId || null,
    approvedRole: req.authContext?.approvedRole || null
  };
  auditLog.recordSecurityEvent(req, {
    eventType: code === 'AUTHENTICATION_REQUIRED' ? 'unauthenticated_access_attempt' : 'permission_denial',
    statusCode: status,
    code,
    permission: req.requiredPermission || null
  }).catch((error) => {
    console.warn(`security audit write failed requestId=${req.requestId || 'unknown'}: ${error.message}`);
  });
  return res.status(status).json({ error: message, code });
}

function enforcePermission(req, res, permission, options = {}) {
  req.authContext = buildAuthContext(req);
  req.requiredPermission = permission || null;
  if (!req.authContext.authenticated) {
    if (isAdminHtmlRequest(req)) {
      return res.redirect('/api/routing/manual-hazards/admin/login');
    }
    return deny(req, res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required.');
  }
  if (options.organizationRequired !== false && !req.authContext.organizationId) {
    return deny(req, res, 403, 'ORGANIZATION_CONTEXT_REQUIRED', 'Organization context is required for this action.');
  }
  if (permission && !rbac.hasPermission(req.authContext, permission)) {
    return deny(req, res, 403, 'PERMISSION_DENIED', 'Insufficient permission for this action.');
  }
  return null;
}

function permissionForRequest(req) {
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.originalUrl || req.path || '').split('?')[0].replace(/\/+$/, '') || '/';

  if (path.startsWith('/api/drivers')) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      ? rbac.PERMISSIONS.DRIVERS_MANAGE
      : rbac.PERMISSIONS.DRIVERS_VIEW;
  }
  if (path.startsWith('/api/route-manifests/import')
    || path.includes('/assign')
    || path.includes('/unassign')
    || path.includes('/switch-assignments')) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      ? rbac.PERMISSIONS.ROUTES_ASSIGN
      : rbac.PERMISSIONS.ROUTES_VIEW;
  }
  if (path.startsWith('/api/route-manifests/documents')
    || path.startsWith('/api/route-manifests/inventory-closeouts')
    || path.startsWith('/api/route-manifests/undelivered')) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      ? rbac.PERMISSIONS.DELIVERY_OPERATE
      : rbac.PERMISSIONS.REPORTS_VIEW;
  }
  if (path.startsWith('/api/route-manifests/warehouse-employees')) {
    return rbac.PERMISSIONS.WAREHOUSE_CONFIRM;
  }
  if (path.startsWith('/api/route-manifests') && !path.startsWith('/api/route-manifests/driver') && !path.startsWith('/api/route-manifests/warehouse')) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      ? rbac.PERMISSIONS.ROUTES_MANAGE
      : rbac.PERMISSIONS.ROUTES_VIEW;
  }
  if (path.startsWith('/api/data-imports')) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      ? rbac.PERMISSIONS.ROUTES_MANAGE
      : rbac.PERMISSIONS.REPORTS_VIEW;
  }
  if (path.startsWith('/api/account-intelligence')) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      ? rbac.PERMISSIONS.DASHBOARD_MANAGE
      : rbac.PERMISSIONS.DASHBOARD_VIEW;
  }
  if (path.startsWith('/api/operational-heatmaps')) return rbac.PERMISSIONS.DASHBOARD_VIEW;
  if (path.startsWith('/api/operational-geography')) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      ? rbac.PERMISSIONS.DASHBOARD_MANAGE
      : rbac.PERMISSIONS.DASHBOARD_VIEW;
  }
  if (path.startsWith('/api/supervisor-intelligence')) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      ? rbac.PERMISSIONS.DASHBOARD_MANAGE
      : rbac.PERMISSIONS.DASHBOARD_VIEW;
  }
  if (path.startsWith('/api/admin')) return rbac.PERMISSIONS.DASHBOARD_VIEW;
  if (path.startsWith('/api/ai/status')) return rbac.PERMISSIONS.DASHBOARD_VIEW;
  if (path.startsWith('/api/ai')) return rbac.PERMISSIONS.DASHBOARD_VIEW;
  if (path.startsWith('/api/delivery-notes/export') || path.startsWith('/api/delivery-notes/admin')) return rbac.PERMISSIONS.REPORTS_VIEW;
  if (path.startsWith('/api/delivery-notes/photos')) return rbac.PERMISSIONS.REPORTS_VIEW;
  if (path.startsWith('/api/routing/route-sessions')) return rbac.PERMISSIONS.ROUTE_REPLAY_VIEW;
  if (path.startsWith('/api/routing/manual-hazards/admin-users')) return rbac.PERMISSIONS.USERS_MANAGE;
  if (path.startsWith('/api/shared-safety/moderation')) {
    if (path.includes('/approve')) return rbac.PERMISSIONS.SHARED_SAFETY_APPROVE;
    if (path.includes('/reject')) return rbac.PERMISSIONS.SHARED_SAFETY_REJECT;
    return rbac.PERMISSIONS.SHARED_SAFETY_REVIEW;
  }
  if (path.startsWith('/api/shared-safety/records') && ['PUT', 'PATCH', 'DELETE'].includes(method)) {
    return rbac.PERMISSIONS.SHARED_SAFETY_RETIRE;
  }
  if (path.startsWith('/api/shared-safety/submissions')) {
    if (path.includes('/nominate')) return rbac.PERMISSIONS.HAZARD_REVIEW_ORGANIZATION;
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      ? rbac.PERMISSIONS.HAZARD_SUBMIT
      : rbac.PERMISSIONS.HAZARD_VIEW_ORGANIZATION;
  }
  if (path.startsWith('/api/bi-kpi')) {
    if (path.endsWith('/export.csv')) return rbac.PERMISSIONS.DASHBOARD_EXPORT;
    if (path.includes('/formulas')) return rbac.PERMISSIONS.KPI_FORMULA_MANAGE;
    if (path.includes('/calculate')) return rbac.PERMISSIONS.KPI_CALCULATE;
    if (path.includes('/snapshots')) return rbac.PERMISSIONS.KPI_SNAPSHOT_VIEW;
    if (path.includes('/dashboards') || path.endsWith('/admin')) {
      return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
        ? rbac.PERMISSIONS.DASHBOARD_MANAGE
        : rbac.PERMISSIONS.DASHBOARD_VIEW;
    }
    if (path.includes('/alerts')) {
      return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
        ? rbac.PERMISSIONS.KPI_ALERT_MANAGE
        : rbac.PERMISSIONS.KPI_VIEW;
    }
    if (path.includes('/definitions')) {
      return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
        ? rbac.PERMISSIONS.KPI_MANAGE
        : rbac.PERMISSIONS.KPI_VIEW;
    }
    return rbac.PERMISSIONS.KPI_VIEW;
  }
  if (path.startsWith('/api/logistics-intelligence')) {
    if (path.includes('/recommendations') && path.includes('/decisions')) return rbac.PERMISSIONS.RECOMMENDATION_DECIDE;
    if (path.includes('/recommendations') && path.includes('/outcomes')) return rbac.PERMISSIONS.OUTCOME_RECORD;
    if (path.includes('/recommendations')) return rbac.PERMISSIONS.RECOMMENDATION_VIEW;
    if (path.includes('/events') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return rbac.PERMISSIONS.INTELLIGENCE_MANAGE;
    if (path.includes('/signals/run') || path.endsWith('/process')) return rbac.PERMISSIONS.INTELLIGENCE_REVIEW;
    if (path.endsWith('/admin')) return rbac.PERMISSIONS.INTELLIGENCE_VIEW;
    return rbac.PERMISSIONS.INTELLIGENCE_VIEW;
  }
  if (path.startsWith('/api/fleet-intelligence-scoring')) {
    if (path.includes('/benchmarks')) return rbac.PERMISSIONS.FLEET_SCORE_BENCHMARK;
    if (path.includes('/calculate')) return rbac.PERMISSIONS.FLEET_SCORE_CALCULATE;
    if (path.includes('/models') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return rbac.PERMISSIONS.FLEET_SCORE_MANAGE;
    return rbac.PERMISSIONS.FLEET_SCORE_VIEW;
  }
  if (path.startsWith('/api/data-lifecycle')) {
    if (path.includes('/legal-holds')) return rbac.PERMISSIONS.LIFECYCLE_LEGAL_HOLD_MANAGE;
    if (path.includes('/data-subject-requests')) return rbac.PERMISSIONS.LIFECYCLE_DSR_MANAGE;
    if (path.includes('/exports')) return rbac.PERMISSIONS.LIFECYCLE_EXPORT;
    if (path.includes('/organizations/termination')) return rbac.PERMISSIONS.LIFECYCLE_ORGANIZATION_TERMINATE;
    if (path.includes('/organizations/purge-preview')) return rbac.PERMISSIONS.LIFECYCLE_ORGANIZATION_REVIEW;
    if (path.includes('/purge/ephemeral-execute')) return rbac.PERMISSIONS.LIFECYCLE_USER_PURGE;
    if (path.includes('/purge') || path.includes('/purge-preview')) return rbac.PERMISSIONS.LIFECYCLE_USER_REVIEW_DELETE;
    if (path.includes('/deactivate')) return rbac.PERMISSIONS.LIFECYCLE_USER_DEACTIVATE;
    if (path.includes('/reactivate')) return rbac.PERMISSIONS.LIFECYCLE_USER_REACTIVATE;
    if (path.includes('/deletion-requests')) return rbac.PERMISSIONS.LIFECYCLE_USER_REQUEST_DELETE;
    return rbac.PERMISSIONS.LIFECYCLE_DSR_MANAGE;
  }
  if (path.startsWith('/api/enterprise-identity')) {
    if (path.includes('/providers') && path.includes('/rotate-secret-reference')) return rbac.PERMISSIONS.IDENTITY_PROVIDER_MANAGE;
    if (path.includes('/providers') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return rbac.PERMISSIONS.IDENTITY_PROVIDER_MANAGE;
    if (path.includes('/providers')) return rbac.PERMISSIONS.IDENTITY_PROVIDER_VIEW;
    if (path.includes('/domains')) return rbac.PERMISSIONS.IDENTITY_DOMAIN_MANAGE;
    if (path.includes('/claim-mappings')) return rbac.PERMISSIONS.IDENTITY_MAPPING_MANAGE;
    if (path.includes('/account-links')) return rbac.PERMISSIONS.IDENTITY_ACCOUNT_LINK_MANAGE;
    if (path.includes('/sso-policy')) return rbac.PERMISSIONS.IDENTITY_SSO_POLICY_MANAGE;
    if (path.includes('/scim')) return rbac.PERMISSIONS.IDENTITY_SCIM_MANAGE;
    if (path.includes('/break-glass')) return rbac.PERMISSIONS.IDENTITY_BREAK_GLASS_MANAGE;
    if (path.includes('/provider-capabilities')) return rbac.PERMISSIONS.IDENTITY_AUDIT_VIEW;
    return rbac.PERMISSIONS.IDENTITY_AUDIT_VIEW;
  }
  if (path.startsWith('/api/routing/manual-hazards/report')) {
    return rbac.PERMISSIONS.HAZARD_SUBMIT;
  }
  if (path.startsWith('/api/routing/manual-hazards') || path.startsWith('/api/routing/hazard-verification') || path.startsWith('/api/routing/hazard-location-backfill')) {
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      ? rbac.PERMISSIONS.HAZARD_REVIEW_ORGANIZATION
      : rbac.PERMISSIONS.HAZARD_VIEW_ORGANIZATION;
  }
  return null;
}

function enforceApiTenantPolicy(req, res, next) {
  if (isPublicPath(req)) return next();
  const permission = permissionForRequest(req);
  if (!permission) return next();
  const path = String(req.originalUrl || req.path || '').split('?')[0].replace(/\/+$/, '') || '/';
  const platformScoped = path.startsWith('/api/shared-safety/moderation')
    || (path.startsWith('/api/shared-safety/records') && ['PUT', 'PATCH', 'DELETE'].includes(String(req.method || 'GET').toUpperCase()));
  const platformAdminWithoutOrganization = req.authContext?.approvedRole === rbac.ROLES.PLATFORM_ADMIN
    && !req.authContext.organizationId;
  const denied = enforcePermission(req, res, permission, { organizationRequired: !(platformScoped || platformAdminWithoutOrganization) });
  if (denied) return denied;
  return next();
}

function assertRequestOrganization(req, organizationId) {
  req.authContext = buildAuthContext(req);
  try {
    return assertSameOrganization(req.authContext.organizationId, organizationId);
  } catch (error) {
    auditLog.recordSecurityEvent(req, {
      eventType: 'cross_tenant_access_denial',
      statusCode: error.status || 403,
      code: error.code || 'TENANT_ISOLATION_VIOLATION',
      organizationId
    }).catch((auditError) => {
      console.warn(`cross-tenant audit write failed requestId=${req.requestId || 'unknown'}: ${auditError.message}`);
    });
    throw error;
  }
}

module.exports = {
  attachAuthContext,
  assertRequestOrganization,
  buildAuthContext,
  enforceApiTenantPolicy,
  requireAuthentication,
  requireOrganizationContext,
  requirePermission,
  requirePlatformAdmin,
  requireRole
};
