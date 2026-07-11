const LEGACY_CONTEXT_LABEL = 'legacy-unscoped';
const UNKNOWN_ORGANIZATION = 'unknown-organization';
const UNKNOWN_DRIVER = 'unknown-driver';

export function cleanTenantValue(value) {
  return String(value || '').trim();
}

export function safeStoragePart(value, fallback = 'unknown') {
  const cleaned = cleanTenantValue(value).toLowerCase();
  return (cleaned || fallback)
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160) || fallback;
}

export function normalizeDriverSession(rawSession = {}) {
  const driver = rawSession.driver || {};
  const companyDriverNumber = cleanTenantValue(
    driver.companyDriverNumber || driver.company_driver_number || driver.driverId || driver.driver_id
  );
  const internalDriverId = cleanTenantValue(
    driver.internalDriverId || driver.internal_driver_id || driver.platformDriverId || driver.platform_driver_id
  );
  const organizationId = cleanTenantValue(driver.organizationId || driver.organization_id || rawSession.organizationId);
  const role = cleanTenantValue(driver.role || rawSession.role || 'DRIVER') || 'DRIVER';
  const permissions = Array.isArray(driver.permissions)
    ? driver.permissions
    : Array.isArray(rawSession.permissions)
      ? rawSession.permissions
      : [];
  const tenantContext = {
    organizationId,
    internalDriverId,
    companyDriverNumber,
    role,
    permissions,
    sessionId: cleanTenantValue(rawSession.sessionId || rawSession.session_id || rawSession.tokenId || rawSession.token_id),
    expiresAt: rawSession.expiresAt || rawSession.expires_at || null,
  };

  return {
    ...rawSession,
    expiresAt: tenantContext.expiresAt,
    tenantContext,
    driver: {
      ...driver,
      driverId: companyDriverNumber || driver.driverId || driver.driver_id || internalDriverId,
      companyDriverNumber,
      internalDriverId,
      organizationId,
      driverName: driver.driverName || driver.driver_name || '',
      role,
      permissions,
    },
  };
}

export function isTrustedTenantContext(context = {}) {
  return Boolean(
    cleanTenantValue(context.organizationId)
    && cleanTenantValue(context.internalDriverId)
    && cleanTenantValue(context.companyDriverNumber)
  );
}

export function tenantIdentityFromSession(session = {}) {
  const normalized = normalizeDriverSession(session);
  return normalized.tenantContext;
}

export function tenantIdentityFromOptions(options = {}, fallbackContext = null) {
  const source = fallbackContext || {};
  return {
    organizationId: cleanTenantValue(options.organizationId || source.organizationId),
    internalDriverId: cleanTenantValue(options.internalDriverId || source.internalDriverId),
    companyDriverNumber: cleanTenantValue(
      options.companyDriverNumber || options.driverId || source.companyDriverNumber
    ),
    driverName: cleanTenantValue(options.driverName || source.driverName),
    role: cleanTenantValue(options.role || source.role || 'DRIVER'),
    permissions: Array.isArray(options.permissions) ? options.permissions : source.permissions || [],
    sessionId: cleanTenantValue(options.sessionId || source.sessionId),
  };
}

export function tenantScopedStorageKey(prefix, identity = {}, ...parts) {
  const organizationId = safeStoragePart(identity.organizationId, UNKNOWN_ORGANIZATION);
  const internalDriverId = safeStoragePart(identity.internalDriverId, UNKNOWN_DRIVER);
  const suffix = parts.map((part) => safeStoragePart(part, 'none')).join('/');
  return `${prefix}/org/${organizationId}/driver/${internalDriverId}${suffix ? `/${suffix}` : ''}`;
}

export function legacyMigrationMarkerKey(prefix, identity = {}) {
  return tenantScopedStorageKey(`${prefix}/migration`, identity, 'legacy-v1');
}

export function legacyQuarantineKey(prefix, reason = 'ambiguous', createdAt = Date.now()) {
  return `${prefix}/quarantine/${safeStoragePart(reason)}/${createdAt}`;
}

export function withTenantOperationMetadata(operation = {}, identity = {}, payloadVersion = 1) {
  return {
    ...operation,
    organizationId: cleanTenantValue(identity.organizationId),
    internalDriverId: cleanTenantValue(identity.internalDriverId),
    companyDriverNumber: cleanTenantValue(identity.companyDriverNumber),
    payloadVersion,
  };
}

export function operationMatchesTenant(operation = {}, identity = {}) {
  return cleanTenantValue(operation.organizationId) === cleanTenantValue(identity.organizationId)
    && cleanTenantValue(operation.internalDriverId) === cleanTenantValue(identity.internalDriverId);
}

export function isLegacyUnscopedRecord(record = {}) {
  return !cleanTenantValue(record.organizationId) || !cleanTenantValue(record.internalDriverId);
}

export function legacyContextLabel() {
  return LEGACY_CONTEXT_LABEL;
}
