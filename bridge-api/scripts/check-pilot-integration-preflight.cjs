#!/usr/bin/env node
require('dotenv').config();

const {
  isLocalDisposableDatabaseUrl,
  validatePilotIntegrationIsolation
} = require('./validate-pilot-integration-runtime.cjs');

function main() {
  const isolation = validatePilotIntegrationIsolation(process.env);
  const status = isolation.safe ? 'SAFE_TO_RUN_MUTATING_PILOT_INTEGRATION' : 'BLOCKED';
  console.log(JSON.stringify({
    status,
    checks: {
      nonProduction: process.env.NODE_ENV !== 'production',
      explicitPilotIntegrationOptIn: process.env.PILOT_INTEGRATION_TEST === 'true',
      explicitMutationOptIn: process.env.ALLOW_MUTATING_TEST_DATA === 'true',
      isolatedDisposableDatabase: isLocalDisposableDatabaseUrl(process.env.DATABASE_URL)
    },
    errors: isolation.errors
  }, null, 2));
  if (!isolation.safe) process.exit(1);
}

main();
