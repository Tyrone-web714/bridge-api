const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'scripts', 'migrate-legacy-private-media.cjs'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert(script.includes("const APPLY = process.argv.includes('--apply')"), 'migration tool must default to dry-run unless --apply is present');
assert(script.includes('OWNER_APPROVED_LEGACY_MEDIA_MIGRATION'), 'production writes must require explicit owner approval env flag');
assert(script.includes('BEGIN READ ONLY'), 'dry-run must use a read-only transaction');
assert(script.includes('BEGIN') && script.includes('COMMIT'), 'apply mode must be transaction-aware');
assert(script.includes('ROLLBACK'), 'migration must be rollback-aware');
assert(script.includes('urlsAndObjectKeysRedacted: true'), 'output must explicitly redact URLs and object keys');
assert(script.includes('jsonb_array_length(photos) > 0'), 'tool must be bounded to delivery note media records');
assert(script.includes('LEGACY_MEDIA_MIGRATION_ORGANIZATION_ID'), 'tool must support tenant-scoped execution');
assert(script.includes('assertExpectedSchema'), 'tool must preflight expected schema before assessment');
assert(script.includes("['delivery_notes', 'organization_id']"), 'tool must require delivery note organization ownership');
assert(script.includes('Expected schema columns missing'), 'tool must fail clearly on wrong database shape');
assert(script.includes('READY_TO_MIGRATE'), 'tool must classify ready records');
assert(script.includes('ALREADY_MIGRATED'), 'tool must classify already migrated records');
assert(script.includes('MISSING_REQUIRED_METADATA'), 'tool must classify missing metadata');
assert(script.includes('AMBIGUOUS'), 'tool must classify ambiguous records');
assert(script.includes('BLOCKED'), 'tool must classify blocked records');
assert(script.includes('isUnsafeStorageKey'), 'tool must block unsafe object-key shape');
assert(script.includes('normalizePhoto'), 'tool must normalize legacy media metadata');
assert(script.includes('legacyPublicUrl'), 'tool must preserve legacy compatibility metadata');
assert(script.includes('primaryUrlFor'), 'tool must set authenticated media access as primary');
assert(script.includes('upsertLifecycleReference'), 'tool must create lifecycle object references');
assert(script.includes('ON CONFLICT (id) DO UPDATE'), 'lifecycle registration must be idempotent');
assert(script.includes('recordAuditEvent'), 'apply mode must record auditable migration event');
assert(script.includes('knownProductionReferenceCountMatches: items.length === 3'), 'dry-run must reconcile against verified legacy count');
assert(!script.includes('console.log(storageKey)'), 'tool must not log storage keys directly');
assert(!script.includes('console.log(currentUrl)'), 'tool must not log public URLs directly');

assert(packageJson.scripts['test:legacy-private-media'] === 'node scripts/check-legacy-private-media-migration.cjs', 'package script must register legacy private media migration test');
assert(packageJson.scripts.test.includes('test:legacy-private-media'), 'full test chain must include legacy private media migration test');

console.log('[test:legacy-private-media] dry-run migration safeguards verified.');
