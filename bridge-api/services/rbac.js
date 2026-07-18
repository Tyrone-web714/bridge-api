const ROLES = Object.freeze({
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  ORGANIZATION_ADMIN: 'ORGANIZATION_ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  DRIVER: 'DRIVER',
  WAREHOUSE_EMPLOYEE: 'WAREHOUSE_EMPLOYEE'
});

const PERMISSIONS = Object.freeze({
  ORGANIZATIONS_MANAGE: 'platform.organizations.manage',
  PLATFORM_CONFIGURE: 'platform.configure',
  BILLING_MANAGE: 'billing.manage',
  SHARED_SAFETY_APPROVE: 'shared_safety.approve',
  SHARED_SAFETY_REVIEW: 'shared_safety.review',
  SHARED_SAFETY_REJECT: 'shared_safety.reject',
  SHARED_SAFETY_PUBLISH: 'shared_safety.publish',
  SHARED_SAFETY_RETIRE: 'shared_safety.retire',
  USERS_MANAGE: 'users.manage',
  DRIVERS_VIEW: 'drivers.view',
  DRIVERS_MANAGE: 'drivers.manage',
  VEHICLES_MANAGE: 'vehicles.manage',
  ROUTES_VIEW: 'routes.view',
  ROUTES_MANAGE: 'routes.manage',
  ROUTES_ASSIGN: 'routes.assign',
  STOPS_MANAGE: 'stops.manage',
  ACCOUNTS_VIEW: 'accounts.view',
  DELIVERY_OPERATE: 'delivery.operate',
  WAREHOUSE_CONFIRM: 'warehouse.confirm',
  HAZARD_SUBMIT: 'hazard.submit',
  HAZARD_VIEW_ORGANIZATION: 'hazard.view.organization',
  HAZARD_REVIEW_ORGANIZATION: 'hazard.review.organization',
  HAZARDS_SUBMIT: 'hazards.submit',
  HAZARDS_REVIEW: 'hazards.review',
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_MANAGE: 'dashboard.manage',
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  KPI_VIEW: 'kpi.view',
  KPI_MANAGE: 'kpi.manage',
  KPI_FORMULA_MANAGE: 'kpi.formula.manage',
  KPI_CALCULATE: 'kpi.calculate',
  KPI_SNAPSHOT_VIEW: 'kpi.snapshot.view',
  DASHBOARD_EXPORT: 'dashboard.export',
  KPI_ALERT_MANAGE: 'kpi.alert.manage',
  PLATFORM_KPI_SUPPORT: 'platform.kpi.support',
  INTELLIGENCE_VIEW: 'intelligence.view',
  INTELLIGENCE_REVIEW: 'intelligence.review',
  INTELLIGENCE_MANAGE: 'intelligence.manage',
  RECOMMENDATION_VIEW: 'recommendation.view',
  RECOMMENDATION_DECIDE: 'recommendation.decide',
  OUTCOME_RECORD: 'outcome.record',
  PLATFORM_INTELLIGENCE_SUPPORT: 'platform.intelligence.support',
  FLEET_SCORE_VIEW: 'fleet_score.view',
  FLEET_SCORE_MANAGE: 'fleet_score.manage',
  FLEET_SCORE_CALCULATE: 'fleet_score.calculate',
  FLEET_SCORE_BENCHMARK: 'fleet_score.benchmark',
  PLATFORM_FLEET_SCORE_SUPPORT: 'platform.fleet_score.support',
  ROUTE_REPLAY_VIEW: 'route_replay.view',
  AUDIT_VIEW: 'audit.view'
});

const ROLE_LABELS = Object.freeze({
  [ROLES.PLATFORM_ADMIN]: 'Platform Admin',
  [ROLES.ORGANIZATION_ADMIN]: 'Organization Admin',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.DRIVER]: 'Driver',
  [ROLES.WAREHOUSE_EMPLOYEE]: 'Warehouse Employee'
});

const LEGACY_ROLE_ALIASES = Object.freeze({
  admin: ROLES.PLATFORM_ADMIN,
  platform_admin: ROLES.PLATFORM_ADMIN,
  platformadmin: ROLES.PLATFORM_ADMIN,
  'platform admin': ROLES.PLATFORM_ADMIN,
  regional_admin: ROLES.ORGANIZATION_ADMIN,
  regional: ROLES.ORGANIZATION_ADMIN,
  organization_admin: ROLES.ORGANIZATION_ADMIN,
  organizationadmin: ROLES.ORGANIZATION_ADMIN,
  'organization admin': ROLES.ORGANIZATION_ADMIN,
  org_admin: ROLES.ORGANIZATION_ADMIN,
  supervisor: ROLES.SUPERVISOR,
  driver: ROLES.DRIVER,
  warehouse: ROLES.WAREHOUSE_EMPLOYEE,
  warehouse_employee: ROLES.WAREHOUSE_EMPLOYEE,
  warehouseemployee: ROLES.WAREHOUSE_EMPLOYEE,
  'warehouse employee': ROLES.WAREHOUSE_EMPLOYEE
});

const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  [ROLES.PLATFORM_ADMIN]: Object.freeze(Object.values(PERMISSIONS)),
  [ROLES.ORGANIZATION_ADMIN]: Object.freeze([
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.DRIVERS_VIEW,
    PERMISSIONS.DRIVERS_MANAGE,
    PERMISSIONS.VEHICLES_MANAGE,
    PERMISSIONS.ROUTES_VIEW,
    PERMISSIONS.ROUTES_MANAGE,
    PERMISSIONS.ROUTES_ASSIGN,
    PERMISSIONS.STOPS_MANAGE,
    PERMISSIONS.ACCOUNTS_VIEW,
    PERMISSIONS.DELIVERY_OPERATE,
    PERMISSIONS.WAREHOUSE_CONFIRM,
    PERMISSIONS.HAZARD_SUBMIT,
    PERMISSIONS.HAZARD_VIEW_ORGANIZATION,
    PERMISSIONS.HAZARD_REVIEW_ORGANIZATION,
    PERMISSIONS.HAZARDS_SUBMIT,
    PERMISSIONS.HAZARDS_REVIEW,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.KPI_VIEW,
    PERMISSIONS.KPI_MANAGE,
    PERMISSIONS.KPI_FORMULA_MANAGE,
    PERMISSIONS.KPI_CALCULATE,
    PERMISSIONS.KPI_SNAPSHOT_VIEW,
    PERMISSIONS.DASHBOARD_EXPORT,
    PERMISSIONS.KPI_ALERT_MANAGE,
    PERMISSIONS.INTELLIGENCE_VIEW,
    PERMISSIONS.INTELLIGENCE_REVIEW,
    PERMISSIONS.INTELLIGENCE_MANAGE,
    PERMISSIONS.RECOMMENDATION_VIEW,
    PERMISSIONS.RECOMMENDATION_DECIDE,
    PERMISSIONS.OUTCOME_RECORD,
    PERMISSIONS.FLEET_SCORE_VIEW,
    PERMISSIONS.FLEET_SCORE_MANAGE,
    PERMISSIONS.FLEET_SCORE_CALCULATE,
    PERMISSIONS.FLEET_SCORE_BENCHMARK,
    PERMISSIONS.ROUTE_REPLAY_VIEW,
    PERMISSIONS.AUDIT_VIEW
  ]),
  [ROLES.SUPERVISOR]: Object.freeze([
    PERMISSIONS.DRIVERS_VIEW,
    PERMISSIONS.DRIVERS_MANAGE,
    PERMISSIONS.ROUTES_VIEW,
    PERMISSIONS.ROUTES_MANAGE,
    PERMISSIONS.ROUTES_ASSIGN,
    PERMISSIONS.STOPS_MANAGE,
    PERMISSIONS.ACCOUNTS_VIEW,
    PERMISSIONS.DELIVERY_OPERATE,
    PERMISSIONS.HAZARD_VIEW_ORGANIZATION,
    PERMISSIONS.HAZARD_REVIEW_ORGANIZATION,
    PERMISSIONS.HAZARDS_REVIEW,
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.KPI_VIEW,
    PERMISSIONS.KPI_CALCULATE,
    PERMISSIONS.KPI_SNAPSHOT_VIEW,
    PERMISSIONS.DASHBOARD_EXPORT,
    PERMISSIONS.INTELLIGENCE_VIEW,
    PERMISSIONS.INTELLIGENCE_REVIEW,
    PERMISSIONS.RECOMMENDATION_VIEW,
    PERMISSIONS.RECOMMENDATION_DECIDE,
    PERMISSIONS.OUTCOME_RECORD,
    PERMISSIONS.FLEET_SCORE_VIEW,
    PERMISSIONS.FLEET_SCORE_CALCULATE,
    PERMISSIONS.FLEET_SCORE_BENCHMARK,
    PERMISSIONS.ROUTE_REPLAY_VIEW
  ]),
  [ROLES.DRIVER]: Object.freeze([
    PERMISSIONS.ROUTES_VIEW,
    PERMISSIONS.STOPS_MANAGE,
    PERMISSIONS.DELIVERY_OPERATE,
    PERMISSIONS.HAZARD_SUBMIT,
    PERMISSIONS.HAZARDS_SUBMIT,
    PERMISSIONS.KPI_VIEW,
    PERMISSIONS.KPI_SNAPSHOT_VIEW,
    PERMISSIONS.RECOMMENDATION_VIEW,
    PERMISSIONS.FLEET_SCORE_VIEW
  ]),
  [ROLES.WAREHOUSE_EMPLOYEE]: Object.freeze([
    PERMISSIONS.ROUTES_VIEW,
    PERMISSIONS.WAREHOUSE_CONFIRM,
    PERMISSIONS.KPI_VIEW,
    PERMISSIONS.INTELLIGENCE_VIEW,
    PERMISSIONS.FLEET_SCORE_VIEW
  ])
});

function cleanRole(value) {
  return String(value || '').trim();
}

function normalizeRole(value) {
  const role = cleanRole(value);
  if (!role) return null;
  if (Object.prototype.hasOwnProperty.call(ROLES, role)) return ROLES[role];
  if (Object.values(ROLES).includes(role)) return role;
  return LEGACY_ROLE_ALIASES[role.toLowerCase()] || null;
}

function isApprovedRole(value) {
  return Boolean(normalizeRole(value));
}

function assertApprovedRole(value) {
  const role = normalizeRole(value);
  if (!role) {
    const error = new Error('Unsupported role. Use one of the approved Truck-Safe Routing roles.');
    error.status = 400;
    error.code = 'UNSUPPORTED_ROLE';
    throw error;
  }
  return role;
}

function permissionsForRole(value) {
  const role = normalizeRole(value);
  return role ? [...(DEFAULT_ROLE_PERMISSIONS[role] || [])] : [];
}

function hasPermission(subject, permission) {
  const permissions = Array.isArray(subject)
    ? subject
    : Array.isArray(subject?.permissions)
      ? subject.permissions
      : permissionsForRole(subject?.approvedRole || subject?.role);
  return permissions.includes(permission);
}

function roleLabel(value) {
  return ROLE_LABELS[normalizeRole(value)] || null;
}

module.exports = {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLES,
  assertApprovedRole,
  hasPermission,
  isApprovedRole,
  normalizeRole,
  permissionsForRole,
  roleLabel
};
