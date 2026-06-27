const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const places = read('routes/places.js');
const repositories = read('db/repositories.js');
const postgres = read('db/postgres.js');
const routing = read('routes/routing.js');
const compliance = read('GOOGLE_MAPS_COMPLIANCE.md');

assert(
  !/public,\s*max-age=/i.test(places),
  'Google image/embed proxy responses must not advertise public caching.'
);
assert(
  places.includes("Cache-Control', 'private, no-store, max-age=0"),
  'Google image/embed proxy responses must explicitly disable caching.'
);
assert(
  !/destination\.(photoUrl|placePhotoUrl|streetViewUrl|phoneNumber|internationalPhoneNumber)/.test(repositories),
  'Recent destinations must not persist Google photo, Street View, or phone enrichment.'
);
assert(
  postgres.includes('UPDATE recent_destinations') &&
    postgres.includes('photo_url = NULL') &&
    postgres.includes('street_view_url = NULL'),
  'Database initialization must purge previously persisted Google visual content.'
);
assert(
  routing.includes("recorded. Google route geometry is not retained.") &&
    routing.includes("event.eventType || '').toLowerCase() === 'gps_trace'"),
  'Route Replay must render the driver GPS trail instead of Google encoded geometry.'
);
assert(
  repositories.includes('JSON.stringify([])') &&
    postgres.includes("route_options = '[]'::jsonb"),
  'Google route options must not be persisted and legacy values must be purged.'
);
assert(
  compliance.includes('## Release Blockers') &&
    compliance.includes('heavy-vehicle') &&
    compliance.includes('public Terms of Use and Privacy Policy'),
  'Compliance record must preserve unresolved commercial-release blockers.'
);

console.log('[test:google-maps-compliance] storage, caching, and blocker controls verified.');
