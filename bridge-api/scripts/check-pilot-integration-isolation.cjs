#!/usr/bin/env node
const assert = require('assert');
const {
  isLocalDisposableDatabaseUrl,
  validatePilotIntegrationIsolation
} = require('./validate-pilot-integration-runtime.cjs');

function main() {
  assert.strictEqual(
    isLocalDisposableDatabaseUrl('postgres://127.0.0.1:55440/pilot_integration_validation'),
    true
  );
  assert.strictEqual(
    isLocalDisposableDatabaseUrl('postgres://localhost:55449/pilot-integration-disposable'),
    true
  );
  assert.strictEqual(isLocalDisposableDatabaseUrl('postgres://db.example.com:5432/prod'), false);
  assert.strictEqual(isLocalDisposableDatabaseUrl('postgres://127.0.0.1:5432/truck_safe_routing'), false);
  assert.strictEqual(isLocalDisposableDatabaseUrl('postgres://127.0.0.1:55440/truck_safe_routing'), false);

  const safe = validatePilotIntegrationIsolation({
    NODE_ENV: 'test',
    PILOT_INTEGRATION_TEST: 'true',
    ALLOW_MUTATING_TEST_DATA: 'true',
    DATABASE_URL: 'postgres://127.0.0.1:55440/pilot_integration_validation'
  });
  assert.strictEqual(safe.safe, true, JSON.stringify(safe.errors));

  const production = validatePilotIntegrationIsolation({
    NODE_ENV: 'production',
    PILOT_INTEGRATION_TEST: 'true',
    ALLOW_MUTATING_TEST_DATA: 'true',
    DATABASE_URL: 'postgres://127.0.0.1:55440/pilot_integration_validation'
  });
  assert.strictEqual(production.safe, false);
  assert.ok(production.errors.some((error) => error.includes('NODE_ENV')));

  const missingOptIn = validatePilotIntegrationIsolation({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://127.0.0.1:55440/pilot_integration_validation'
  });
  assert.strictEqual(missingOptIn.safe, false);
  assert.ok(missingOptIn.errors.some((error) => error.includes('PILOT_INTEGRATION_TEST')));
  assert.ok(missingOptIn.errors.some((error) => error.includes('ALLOW_MUTATING_TEST_DATA')));

  console.log('[test:pilot-integration-isolation] fail-closed isolation guards verified.');
}

main();
