const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PACKAGE_DIR = path.join(
  ROOT,
  'docs',
  'ai-development',
  'model-selection',
  'd1-organization-data-handoff'
);
const EXTERNAL_DIR = path.join(PACKAGE_DIR, 'external');
const INTERNAL_DIR = path.join(PACKAGE_DIR, 'internal');

const requiredExternal = [
  'README.md',
  'TRUCK_SAFE_ROUTING_HISTORICAL_DATA_REQUEST.md',
  'ROUTE_MANIFEST_HISTORY_FIELD_SPEC.md',
  'ROUTE_STOP_HISTORY_FIELD_SPEC.md',
  'DELIVERY_OUTCOME_HISTORY_FIELD_SPEC.md',
  'HISTORICAL_DATA_AVAILABILITY_QUESTIONNAIRE.md',
  'ORGANIZATION_DATA_EXPORT_CHECKLIST.md',
  'HISTORICAL_DATA_EXPORT_MANIFEST_TEMPLATE.json',
  'ROUTE_MANIFEST_HISTORY_TEMPLATE.csv',
  'ROUTE_STOP_HISTORY_TEMPLATE.csv',
  'DELIVERY_OUTCOME_HISTORY_TEMPLATE.csv',
  'DELIVERY_OUTCOME_CODE_DICTIONARY_TEMPLATE.csv',
  'SOURCE_TO_TSR_MAPPING_WORKSHEET.csv'
];

const requiredInternal = ['D1_EXTERNAL_DATA_REQUEST_HANDOFF_RECORD.md'];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertExists(filePath) {
  assert(fs.existsSync(filePath), `${filePath} must exist`);
}

for (const file of requiredExternal) {
  assertExists(path.join(EXTERNAL_DIR, file));
}
for (const file of requiredInternal) {
  assertExists(path.join(INTERNAL_DIR, file));
}

const expectedHeaders = {
  'ROUTE_MANIFEST_HISTORY_TEMPLATE.csv':
    'organization_code,source_system,source_record_id,route_id,route_date,depot_or_location_id,planned_start_at,actual_start_at,planned_completion_at,actual_completion_at,route_status,planned_stop_count,actual_completed_stop_count,cancelled_indicator,aborted_indicator,reassignment_indicator,driver_id_if_approved,vehicle_id_if_approved,timezone',
  'ROUTE_STOP_HISTORY_TEMPLATE.csv':
    'organization_code,source_system,source_record_id,route_id,stop_id,route_date,stop_sequence,account_id,planned_arrival_at,actual_arrival_at,service_start_at,service_end_at,delivery_status,partial_delivery_indicator,non_delivery_reason_code,rescheduled_indicator,cancelled_indicator,exception_code,timezone',
  'DELIVERY_OUTCOME_HISTORY_TEMPLATE.csv':
    'organization_code,source_system,source_record_id,route_id,stop_id,route_date,raw_source_outcome_code,raw_non_delivery_reason_code,safe_code_description,status_effective_at,delivered_indicator,partial_delivery_indicator,rescheduled_indicator,cancelled_indicator,timezone',
  'DELIVERY_OUTCOME_CODE_DICTIONARY_TEMPLATE.csv':
    'source_system,source_code,source_description,active_from,active_to,notes',
  'SOURCE_TO_TSR_MAPPING_WORKSHEET.csv':
    'requested_concept,organization_source_system,organization_table_or_export,organization_field,transformation_required,source_data_type,timezone,status,notes'
};

for (const [file, header] of Object.entries(expectedHeaders)) {
  const lines = read(path.join(EXTERNAL_DIR, file)).trim().split(/\r?\n/);
  assert.strictEqual(lines.length, 1, `${file} must be header-only`);
  assert.strictEqual(lines[0], header, `${file} header changed`);
}

const manifest = JSON.parse(read(path.join(EXTERNAL_DIR, 'HISTORICAL_DATA_EXPORT_MANIFEST_TEMPLATE.json')));
for (const key of [
  'organizationCode',
  'sourceSystem',
  'exportDate',
  'coverageStart',
  'coverageEnd',
  'timezone',
  'files',
  'recordCounts',
  'fileChecksums',
  'dataDictionaryIncluded',
  'outcomeDictionaryIncluded',
  'technicalContactRole',
  'secureTransferMethod'
]) {
  assert(Object.prototype.hasOwnProperty.call(manifest, key), `${key} missing from export manifest`);
}

const allText = requiredExternal
  .concat(requiredInternal.map((file) => path.join('..', 'internal', file)))
  .map((file) => {
    const target = file.startsWith('..')
      ? path.join(INTERNAL_DIR, path.basename(file))
      : path.join(EXTERNAL_DIR, file);
    return read(target);
  })
  .join('\n');

for (const requiredText of [
  'Receipt of an export does not mean the data has been accepted as representative',
  'Do not put credentials',
  'stable internal identifiers',
  'ISO 8601 with offset',
  'D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA',
  'prediction.route_completion_forecast',
  'prediction.delivery_failure_risk'
]) {
  assert(allText.includes(requiredText), `required handoff language missing: ${requiredText}`);
}

const forbiddenSecretPattern =
  /(sk-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|Bearer\s+[A-Za-z0-9._-]{12,}|password\s*[:=]\s*[^,\s]+|api[_-]?key\s*[:=]\s*[^,\s]+)/i;
assert(!forbiddenSecretPattern.test(allText), 'handoff package must not contain secrets');

const forbiddenExamplePattern =
  /(@example\.com|\b\d{3}[-.]\d{3}[-.]\d{4}\b|\b\d{3}-\d{2}-\d{4}\b|123 Main|John Doe|Jane Doe)/i;
assert(!forbiddenExamplePattern.test(allText), 'handoff package must not contain obvious PII examples');

const request = read(path.join(EXTERNAL_DIR, 'TRUCK_SAFE_ROUTING_HISTORICAL_DATA_REQUEST.md'));
assert(request.includes('will not activate automated operational decisions'));
assert(request.toLowerCase().includes('do not include driver names'));
assert(request.includes('not intended to become an AI workforce scoring system'));

const d2Path = path.join(
  ROOT,
  'docs',
  'ai-development',
  'model-selection',
  'ms-004-comparative-benchmark-execution',
  'FINAL_D2_MODEL_SELECTION.json'
);
const d2 = JSON.parse(read(d2Path));
const driver = d2.matrix.find((entry) => entry.capabilityId === 'driver.copilot.contextual_response');
assert(driver, 'Driver D2 selection must exist');
assert.strictEqual(driver.selectedProvider || driver.provider, 'mistral');
assert.strictEqual(driver.selectedModel || driver.model, 'mistral-small-2603');
assert.strictEqual(d2.d1Status, 'D1_PIPELINE_VALIDATED_SELECTION_PENDING_REPRESENTATIVE_DATA');

console.log('[test:d1-organization-data-handoff] external package, templates, privacy boundary, D1 state, and D2 lock verified.');
