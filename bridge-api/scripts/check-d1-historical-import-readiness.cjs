const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PACKAGE_DIR = path.join(
  ROOT,
  'docs',
  'ai-development',
  'model-selection',
  'd1-historical-data-import-readiness'
);

const requiredDocs = [
  'D1_HISTORICAL_DATA_IMPORT_ARCHITECTURE.md',
  'D1_WAVE1_CANONICAL_DATA_CONTRACT.md',
  'D1_ROUTE_COMPLETION_FIELD_SPEC.md',
  'D1_DELIVERY_OUTCOME_FIELD_SPEC.md',
  'D1_DELIVERY_OUTCOME_TAXONOMY.md',
  'D1_SOURCE_MAPPING_SPEC.md',
  'D1_IMPORT_VALIDATION_RULES.md',
  'D1_IMPORT_QUARANTINE_POLICY.md',
  'D1_IMPORT_PROVENANCE_SPEC.md',
  'D1_DATA_MINIMIZATION_AND_SECURITY.md',
  'D1_TARGET_DERIVATION_SPEC.md',
  'D1_LEAKAGE_CLASSIFICATION.md',
  'D1_ORGANIZATION_DATA_REQUEST_TEMPLATE.md',
  'D1_REPRESENTATIVE_DATA_READINESS_CHECK.md',
  'D1_HISTORICAL_IMPORT_WORKFLOW.md'
];

const requiredSchemas = [
  'schemas/field_manifest.json',
  'schemas/outcome_taxonomy.json',
  'schemas/validation_rules.json',
  'schemas/import_manifest_schema.json'
];

const requiredTemplates = [
  'templates/historical-route-manifests-template.csv',
  'templates/historical-route-stops-template.csv',
  'templates/historical-delivery-outcomes-template.csv',
  'templates/historical-import-manifest-template.json'
];

function read(relativePath) {
  return fs.readFileSync(path.join(PACKAGE_DIR, relativePath), 'utf8');
}

for (const file of [...requiredDocs, ...requiredSchemas, ...requiredTemplates]) {
  assert(fs.existsSync(path.join(PACKAGE_DIR, file)), `${file} must exist`);
}

const architecture = read('D1_HISTORICAL_DATA_IMPORT_ARCHITECTURE.md');
assert(architecture.includes('prediction.route_completion_forecast'));
assert(architecture.includes('prediction.delivery_failure_risk'));
assert(architecture.includes('PARTIAL'));
assert(architecture.includes('MISSING_FOR_IMPORT'));
assert(architecture.includes('zero writes') || architecture.includes('zero-write') || architecture.includes('zero writes'));

const taxonomy = JSON.parse(read('schemas/outcome_taxonomy.json'));
for (const outcome of ['DELIVERED', 'CUSTOMER_REFUSED', 'TIME_WINDOW_FAILURE', 'NO_PAYMENT', 'UNKNOWN']) {
  assert(taxonomy.canonicalOutcomes.includes(outcome), `${outcome} taxonomy entry missing`);
}
assert.strictEqual(taxonomy.existingTsrReasonMappings.customer_refused, 'CUSTOMER_REFUSED');

const fieldManifest = JSON.parse(read('schemas/field_manifest.json'));
assert.strictEqual(fieldManifest.capabilities.length, 2);
for (const capability of fieldManifest.capabilities) {
  assert(capability.capabilityId.startsWith('prediction.'));
  assert(capability.fields.some((field) => field.name === 'organization_id' && field.requirement === 'REQUIRED'));
  assert(capability.fields.some((field) => field.name === 'source_record_id' && field.requirement === 'REQUIRED'));
}

const validationRules = JSON.parse(read('schemas/validation_rules.json'));
for (const ruleId of [
  'ORGANIZATION_ID_MISSING',
  'CROSS_TENANT_RELATIONSHIP',
  'DUPLICATE_SOURCE_RECORD',
  'UNKNOWN_OUTCOME_CODE',
  'POST_OUTCOME_FEATURE',
  'DEMO_TEST_SYNTHETIC'
]) {
  assert(validationRules.rules.some((rule) => rule.id === ruleId), `${ruleId} validation rule missing`);
}

const manifestSchema = JSON.parse(read('schemas/import_manifest_schema.json'));
assert(manifestSchema.requiredFields.includes('organizationId'));
assert(manifestSchema.requiredFields.includes('dryRun'));
assert(manifestSchema.prohibitedFields.includes('credentials'));

for (const template of requiredTemplates.filter((file) => file.endsWith('.csv'))) {
  const lines = read(template).trim().split(/\r?\n/);
  assert.strictEqual(lines.length, 1, `${template} must be header-only`);
  assert(lines[0].includes('organization_id'), `${template} must require organization_id`);
  assert(lines[0].includes('source_system'), `${template} must require source_system`);
  assert(lines[0].includes('source_record_id'), `${template} must require source_record_id`);
}

const workflow = read('D1_HISTORICAL_IMPORT_WORKFLOW.md');
assert(workflow.includes('bridge-api/data/route-manifest-2026-06-20-827826.csv'));
assert(workflow.includes('do not retrofit `organization_id`'));

const d2SelectionPath = path.join(
  ROOT,
  'docs',
  'ai-development',
  'model-selection',
  'ms-004-comparative-benchmark-execution',
  'FINAL_D2_MODEL_SELECTION.json'
);
const d2 = JSON.parse(fs.readFileSync(d2SelectionPath, 'utf8'));
const driver = d2.matrix.find((entry) => entry.capabilityId === 'driver.copilot.contextual_response');
assert(driver, 'Driver D2 final selection must exist');
assert.strictEqual(driver.selectedProvider || driver.provider, 'mistral');
assert.strictEqual(driver.selectedModel || driver.model, 'mistral-small-2603');
assert.strictEqual(d2.d1Status, 'D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA');

console.log('[test:d1-historical-import-readiness] docs, schemas, templates, D1 boundary, and D2 lock verified.');
