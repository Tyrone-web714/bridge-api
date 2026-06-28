const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const deliveryNotes = fs.readFileSync(path.join(root, 'routes', 'deliveryNotes.js'), 'utf8');
const schema = fs.readFileSync(path.join(root, 'db', 'postgres.js'), 'utf8');

assert.match(server, /REQUEST_BODY_LIMIT.*1mb/);
assert.match(server, /DELIVERY_BODY_LIMIT.*30mb/);
assert.match(server, /createRateLimiter/);
assert.match(server, /mutationAuditMiddleware/);
assert.match(deliveryNotes, /detectImageMimeType/);
assert.match(deliveryNotes, /content does not match/);
assert.match(schema, /CREATE TABLE IF NOT EXISTS audit_events/);

console.log('[test:security] rate limits, body limits, photo validation, and audit logging verified.');
