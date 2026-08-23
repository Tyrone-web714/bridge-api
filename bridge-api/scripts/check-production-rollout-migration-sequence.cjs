#!/usr/bin/env node
const assert = require('assert');
const {
  APPROVED_MIGRATION_SEQUENCE,
  validateMigrationFileSequence
} = require('./validate-production-rollout.cjs');

function without(name) {
  return APPROVED_MIGRATION_SEQUENCE.filter((candidate) => candidate !== name);
}

function main() {
  assert.strictEqual(validateMigrationFileSequence(APPROVED_MIGRATION_SEQUENCE).valid, true);

  const missing011 = validateMigrationFileSequence(without('011_driver_copilot_permission_repair.sql'));
  assert.strictEqual(missing011.valid, false);
  assert.ok(missing011.errors.some((error) => error.includes('missing approved migration: 011_driver_copilot_permission_repair.sql')));

  const reversed = [...APPROVED_MIGRATION_SEQUENCE];
  const index011 = reversed.indexOf('011_driver_copilot_permission_repair.sql');
  const index012 = reversed.indexOf('012_intelligence_execution_foundation.sql');
  [reversed[index011], reversed[index012]] = [reversed[index012], reversed[index011]];
  assert.strictEqual(validateMigrationFileSequence(reversed).valid, false);

  const duplicate = [...APPROVED_MIGRATION_SEQUENCE, '012_intelligence_execution_foundation.sql'];
  assert.strictEqual(validateMigrationFileSequence(duplicate).valid, false);
  assert.ok(validateMigrationFileSequence(duplicate).errors.some((error) => error.includes('duplicate migration detected')));

  const gap = APPROVED_MIGRATION_SEQUENCE.map((name) =>
    name === '012_intelligence_execution_foundation.sql'
      ? '013_intelligence_execution_foundation.sql'
      : name
  );
  assert.strictEqual(validateMigrationFileSequence(gap).valid, false);
  assert.ok(validateMigrationFileSequence(gap).errors.some((error) => error.includes('migration numbering gap')));

  const unknown = [...APPROVED_MIGRATION_SEQUENCE, '013_unapproved.sql'];
  assert.strictEqual(validateMigrationFileSequence(unknown).valid, false);
  assert.ok(validateMigrationFileSequence(unknown).errors.some((error) => error.includes('unapproved migration file')));

  console.log('[test:production-rollout-migrations] migration sequence regression checks passed.');
}

main();
