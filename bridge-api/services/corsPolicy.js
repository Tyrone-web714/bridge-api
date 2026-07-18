function cleanOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function parseAllowedOrigins(value) {
  return String(value || '')
    .split(',')
    .map(cleanOrigin)
    .filter(Boolean);
}

function isOriginSyntaxSafe(origin) {
  if (origin === '*') return true;
  try {
    const parsed = new URL(origin);
    return ['http:', 'https:'].includes(parsed.protocol)
      && parsed.origin === origin
      && !origin.includes('*');
  } catch {
    return false;
  }
}

function buildCorsConfig(env = process.env, options = {}) {
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  const production = nodeEnv === 'production';
  const configured = parseAllowedOrigins(env.CORS_ORIGIN);
  const origins = configured.length
    ? configured
    : options.allowDevelopmentDefault && !production
      ? ['*']
      : [];
  const invalidOrigins = origins.filter((origin) => !isOriginSyntaxSafe(origin));
  const wildcard = origins.includes('*');

  if (production && wildcard) {
    const error = new Error('CORS_ORIGIN cannot contain wildcard in production.');
    error.code = 'INVALID_PRODUCTION_CORS_ORIGIN';
    throw error;
  }
  if (invalidOrigins.length) {
    const error = new Error('CORS_ORIGIN contains malformed origins.');
    error.code = 'INVALID_CORS_ORIGIN';
    error.invalidOrigins = invalidOrigins;
    throw error;
  }

  return Object.freeze({
    origins: Object.freeze(origins.filter((origin) => origin !== '*')),
    allowWildcard: wildcard && !production,
    production
  });
}

function isOriginAllowed(origin, config) {
  if (!origin) return true;
  const normalized = cleanOrigin(origin);
  if (!isOriginSyntaxSafe(normalized) || normalized === '*') return false;
  return Boolean(config?.allowWildcard || config?.origins?.includes(normalized));
}

module.exports = {
  buildCorsConfig,
  cleanOrigin,
  isOriginAllowed,
  parseAllowedOrigins
};
