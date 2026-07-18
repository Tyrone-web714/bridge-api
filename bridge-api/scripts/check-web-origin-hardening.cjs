const assert = require('assert');
const fs = require('fs');
const path = require('path');
const corsPolicy = require('../services/corsPolicy');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const deployment = fs.readFileSync(path.join(root, 'DEPLOYMENT.md'), 'utf8');

const single = corsPolicy.buildCorsConfig({
  NODE_ENV: 'production',
  CORS_ORIGIN: 'https://truck-safe-routing-api.onrender.com'
});
assert.deepStrictEqual(single.origins, ['https://truck-safe-routing-api.onrender.com']);
assert.strictEqual(corsPolicy.isOriginAllowed('https://truck-safe-routing-api.onrender.com', single), true);
assert.strictEqual(corsPolicy.isOriginAllowed('https://evil.example.test', single), false);
assert.strictEqual(corsPolicy.isOriginAllowed(undefined, single), true);

const multiple = corsPolicy.buildCorsConfig({
  NODE_ENV: 'production',
  CORS_ORIGIN: 'https://admin.example.com, https://app.example.com'
});
assert.strictEqual(corsPolicy.isOriginAllowed('https://admin.example.com', multiple), true);
assert.strictEqual(corsPolicy.isOriginAllowed('https://app.example.com', multiple), true);
assert.strictEqual(corsPolicy.isOriginAllowed('https://admin.example.com.evil.test', multiple), false);
assert.strictEqual(corsPolicy.isOriginAllowed('http://localhost:8081', multiple), false);

assert.throws(() => corsPolicy.buildCorsConfig({
  NODE_ENV: 'production',
  CORS_ORIGIN: '*'
}), /wildcard/i);
assert.throws(() => corsPolicy.buildCorsConfig({
  NODE_ENV: 'production',
  CORS_ORIGIN: 'https://good.example.com,not an origin'
}), /malformed/i);

const dev = corsPolicy.buildCorsConfig({ NODE_ENV: 'development', CORS_ORIGIN: '*' });
assert.strictEqual(corsPolicy.isOriginAllowed('http://localhost:8081', dev), true);

assert(server.includes('corsPolicy.buildCorsConfig'), 'server must use centralized CORS policy');
assert(server.includes("app.use('/api/media', hydrateDriverBearerIfPresent)"), 'media route must hydrate driver bearer sessions');
assert(deployment.includes('CORS_ORIGIN=https://your-approved-origin.example'), 'deployment docs must keep CORS environment configured');

console.log('[test:web-origin] explicit CORS allowlist behavior verified.');
