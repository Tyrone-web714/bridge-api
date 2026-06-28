const crypto = require('crypto');

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter({
  name,
  windowMs = 15 * 60 * 1000,
  max = 100,
  keyGenerator = clientKey
}) {
  const buckets = new Map();
  const effectiveWindowMs = positiveInteger(windowMs, 15 * 60 * 1000);
  const effectiveMax = positiveInteger(max, 100);

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = `${name}:${keyGenerator(req)}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + effectiveWindowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader('RateLimit-Limit', effectiveMax);
    res.setHeader('RateLimit-Remaining', Math.max(0, effectiveMax - bucket.count));
    res.setHeader('RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    if (bucket.count > effectiveMax) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({
        error: 'Too many requests. Wait briefly and try again.',
        requestId: req.requestId || null
      });
    }
    return next();
  };
}

function hashNetworkAddress(req) {
  const value = clientKey(req);
  const salt =
    process.env.AUDIT_LOG_HASH_SECRET ||
    process.env.ADMIN_DASHBOARD_SECRET ||
    'truck-safe-routing-audit';
  return crypto.createHmac('sha256', salt).update(value).digest('hex').slice(0, 24);
}

module.exports = {
  createRateLimiter,
  hashNetworkAddress,
  positiveInteger
};
