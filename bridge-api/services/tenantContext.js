const crypto = require('crypto');

const BOOTSTRAP_ORGANIZATION = Object.freeze({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Truck-Safe Routing Development',
  slug: 'truck-safe-routing-development',
  status: 'active'
});

function normalizeOrganizationId(value) {
  const cleaned = String(value || '').trim();
  return cleaned || null;
}

function normalizeActor(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    type: String(value.type || value.actorType || '').trim() || null,
    id: String(value.id || value.actorId || '').trim() || null,
    role: String(value.role || '').trim() || null,
    permissions: Array.isArray(value.permissions) ? value.permissions.slice() : []
  };
}

function createRequestCorrelationId(value) {
  const cleaned = String(value || '').trim();
  return cleaned || crypto.randomUUID();
}

function normalizeCompanyIdentifier(value) {
  const cleaned = String(value || '').trim();
  return cleaned || null;
}

function createLegacyDriverStorageId(organizationId, companyDriverNumber) {
  const orgId = normalizeOrganizationId(organizationId);
  const driverNumber = normalizeCompanyIdentifier(companyDriverNumber);
  if (!orgId || !driverNumber) {
    const error = new Error('organizationId and companyDriverNumber are required for driver storage identity.');
    error.code = 'DRIVER_IDENTITY_REQUIRED';
    error.status = 400;
    throw error;
  }
  if (orgId === BOOTSTRAP_ORGANIZATION.id) {
    return driverNumber;
  }
  const digest = crypto
    .createHash('sha256')
    .update(`${orgId}:${driverNumber.toLowerCase()}`)
    .digest('hex')
    .slice(0, 24);
  return `drv_${digest}`;
}

function createTenantContext(input = {}) {
  const organizationId = normalizeOrganizationId(input.organizationId || input.organization_id);
  if (!organizationId) {
    const error = new Error('organizationId is required for Organization-private data access.');
    error.code = 'TENANT_CONTEXT_REQUIRED';
    error.status = 400;
    throw error;
  }

  return Object.freeze({
    organizationId,
    actor: normalizeActor(input.actor),
    role: String(input.role || input.actor?.role || '').trim() || null,
    permissions: Array.isArray(input.permissions) ? input.permissions.slice() : [],
    requestId: createRequestCorrelationId(input.requestId || input.request_id)
  });
}

function createBootstrapDevelopmentTenantContext(input = {}) {
  return createTenantContext({
    ...input,
    organizationId: BOOTSTRAP_ORGANIZATION.id,
    actor: input.actor || {
      type: 'system',
      id: 'development-compatibility',
      role: 'Platform Admin'
    }
  });
}

function resolveTenantContext(input = {}, options = {}) {
  if (input?.organizationId || input?.organization_id) {
    return createTenantContext(input);
  }
  if (options.allowDevelopmentFallback === true) {
    return createBootstrapDevelopmentTenantContext(input);
  }
  return createTenantContext(input);
}

function assertSameOrganization(left, right) {
  const leftId = normalizeOrganizationId(left?.organizationId || left?.organization_id || left);
  const rightId = normalizeOrganizationId(right?.organizationId || right?.organization_id || right);
  if (!leftId || !rightId || leftId !== rightId) {
    const error = new Error('Cross-Organization access is not allowed.');
    error.code = 'TENANT_ISOLATION_VIOLATION';
    error.status = 403;
    throw error;
  }
  return true;
}

function scopedCacheKey(tenantContext, keyParts = []) {
  const context = resolveTenantContext(tenantContext);
  return ['org', context.organizationId, ...keyParts.map((part) => String(part || ''))].join(':');
}

module.exports = {
  BOOTSTRAP_ORGANIZATION,
  assertSameOrganization,
  createBootstrapDevelopmentTenantContext,
  createLegacyDriverStorageId,
  createTenantContext,
  normalizeCompanyIdentifier,
  normalizeOrganizationId,
  resolveTenantContext,
  scopedCacheKey
};
