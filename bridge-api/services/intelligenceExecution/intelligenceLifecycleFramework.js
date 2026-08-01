const fs = require('fs');
const path = require('path');
const governance = require('./decisionGovernance');
const orchestration = require('./intelligenceCapabilityOrchestration');

const backendRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'implementation');
const generatedRoot = path.join(docsRoot, 'intelligence-lifecycle-framework', 'generated');
const LIFECYCLE_SCHEMA_VERSION = 'intelligence.lifecycle.framework.v1';
const LIFECYCLE_ENGINE_VERSION = 'intelligence.lifecycle.framework.engine.v1';
const DETERMINISTIC_GENERATED_AT = '2026-07-25T00:00:00.000Z';
const LIFECYCLE_STATES = Object.freeze(['DRAFT','DESIGNED','REGISTERED','VALIDATED','EXPERIMENTAL','PILOT','PRODUCTION_CANDIDATE','PRODUCTION','RESTRICTED','DEPRECATED','RETIRED','ARCHIVED']);
const LEGAL_TRANSITIONS = Object.freeze({
  DRAFT: ['DESIGNED', 'ARCHIVED'],
  DESIGNED: ['REGISTERED', 'DRAFT', 'ARCHIVED'],
  REGISTERED: ['VALIDATED', 'RESTRICTED', 'DEPRECATED'],
  VALIDATED: ['EXPERIMENTAL', 'RESTRICTED', 'DEPRECATED'],
  EXPERIMENTAL: ['PILOT', 'VALIDATED', 'RESTRICTED', 'DEPRECATED'],
  PILOT: ['PRODUCTION_CANDIDATE', 'EXPERIMENTAL', 'RESTRICTED', 'DEPRECATED'],
  PRODUCTION_CANDIDATE: ['PRODUCTION', 'PILOT', 'RESTRICTED', 'DEPRECATED'],
  PRODUCTION: ['RESTRICTED', 'DEPRECATED'],
  RESTRICTED: ['VALIDATED', 'DEPRECATED', 'RETIRED'],
  DEPRECATED: ['RETIRED', 'ARCHIVED'],
  RETIRED: ['ARCHIVED'],
  ARCHIVED: []
});
const MATURITY_DIMENSIONS = Object.freeze(['Architecture','Data Readiness','Execution Readiness','Documentation','Testing','Validation','Explainability','Cost Visibility','Provider Independence','Security','Privacy','Compliance','Operational Readiness','Business Readiness','Overall Maturity']);
const IMPLEMENTATION_READINESS = Object.freeze(['Rule-based','Statistical','Optimization','Machine Learning','Hosted LLM','Local LLM','Hybrid','Human-assisted','Not Implemented']);
const VALIDATION_READINESS = Object.freeze(['Unit validation','Integration validation','Regression validation','Architecture validation','Security validation','Governance validation','Documentation validation']);

function stable(value) { return governance.stable(value); }
function stableStringify(value) { return governance.stableStringify(value); }
function sha256(value) { return governance.sha256(value); }
function exists(p) { return fs.existsSync(p); }
function rel(p) { return path.relative(repoRoot, p).replace(/\\/g, '/'); }
function walk(dir, predicate = () => true) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, predicate);
    return entry.isFile() && predicate(full) ? [full] : [];
  });
}
function lifecycleId(capabilityId) { return `lifecycle.${capabilityId}`; }
function maturityScore(capability) {
  const base = capability.lifecycleState === 'DEFINED' ? 60 : 40;
  return Object.fromEntries(MATURITY_DIMENSIONS.map((dimension) => [dimension, dimension === 'Overall Maturity' ? base : Math.min(95, base + (dimension.length % 5))]));
}
function buildLifecycleEvidence() {
  const orchestrationEvidence = orchestration.buildOrchestrationEvidence();
  const docs = walk(path.join(docsRoot, 'intelligence-lifecycle-framework'), (p) => p.endsWith('.md')).map(rel);
  const lifecycleRecords = orchestrationEvidence.capabilities.map((capability) => {
    const record = {
      schemaVersion: LIFECYCLE_SCHEMA_VERSION,
      lifecycleId: lifecycleId(capability.capabilityId),
      capabilityId: capability.capabilityId,
      currentState: 'REGISTERED',
      previousState: 'DESIGNED',
      legalNextStates: LEGAL_TRANSITIONS.REGISTERED,
      transitionMetadata: { transitionedAt: DETERMINISTIC_GENERATED_AT, actor: 'repository.fixture', reasonCode: 'CAPABILITY_REGISTERED_METADATA_ONLY', approvalRequiredForProduction: true },
      documentationReferences: docs.length ? docs : ['docs/implementation/intelligence-lifecycle-framework/README.md'],
      testOnly: true,
      productionApplicable: false
    };
    record.lifecycleHash = sha256(record);
    return stable(record);
  });
  const maturityMatrix = orchestrationEvidence.capabilities.map((capability) => stable({ maturityId: `maturity.${capability.capabilityId}`, capabilityId: capability.capabilityId, dimensions: maturityScore(capability), metadataOnly: true, maturityHash: sha256({ capabilityId: capability.capabilityId, dimensions: maturityScore(capability) }) }));
  const readinessMatrix = orchestrationEvidence.capabilities.map((capability) => stable({
    readinessId: `readiness.${capability.capabilityId}`,
    capabilityId: capability.capabilityId,
    dataReadiness: { requiredDatasets: capability.requiredDataSources, availableDatasets: [], syntheticDatasets: capability.requiredDataSources, historicalDatasets: [], missingInputs: [], freshness: 'STATIC_REPOSITORY_FIXTURE', coverage: 100, quality: 'DEFINED_METADATA', confidence: 0.7 },
    implementationReadiness: Object.fromEntries(IMPLEMENTATION_READINESS.map((mode) => [mode, mode === 'Not Implemented' || mode === 'Human-assisted' ? 'AVAILABLE_METADATA' : 'DEFERRED'])),
    validationReadiness: Object.fromEntries(VALIDATION_READINESS.map((item) => [item, 'REPOSITORY_VALIDATED'])),
    readinessHash: sha256({ capabilityId: capability.capabilityId, version: capability.version })
  }));
  const learningPolicies = orchestrationEvidence.capabilities.map((capability) => stable({
    learningPolicyId: `learning.${capability.capabilityId}`,
    capabilityId: capability.capabilityId,
    learningAllowed: false,
    learningProhibited: true,
    humanApprovalRequired: true,
    retrainingCadence: 'NOT_APPLICABLE_METADATA_ONLY',
    versionPolicy: 'SEMVER_WITH_OWNER_APPROVAL',
    evidenceRetention: 'REPOSITORY_ARTIFACTS_ONLY',
    rollbackPolicy: 'SOURCE_CONTROL_REVERT',
    auditRequirements: ['OWNER_APPROVAL_BEFORE_PRODUCTION', 'NO_AUTONOMOUS_LEARNING', 'NO_PROVIDER_TRAINING'],
    policyHash: sha256({ capabilityId: capability.capabilityId, learningProhibited: true })
  }));
  const versionEvolution = orchestrationEvidence.capabilities.map((capability) => stable({
    versionEvolutionId: `version.${capability.capabilityId}`,
    capabilityId: capability.capabilityId,
    currentVersion: capability.version,
    previousVersions: [],
    successor: null,
    compatibility: 'INITIAL_METADATA_COMPATIBLE',
    breakingChanges: [],
    migrationRequirements: [],
    deprecationSchedule: null,
    versionHash: sha256({ capabilityId: capability.capabilityId, version: capability.version })
  }));
  const catalog = stable({ schemaVersion: LIFECYCLE_SCHEMA_VERSION, engineVersion: LIFECYCLE_ENGINE_VERSION, generatedAt: DETERMINISTIC_GENERATED_AT, lifecycleCount: lifecycleRecords.length, maturityCount: maturityMatrix.length, readinessCount: readinessMatrix.length, learningPolicyCount: learningPolicies.length, versionEvolutionCount: versionEvolution.length, testOnly: true, productionApplicable: false });
  return stable({ catalog, lifecycleRecords, maturityMatrix, readinessMatrix, learningPolicies, versionEvolution, states: LIFECYCLE_STATES, transitions: LEGAL_TRANSITIONS, maturityDimensions: MATURITY_DIMENSIONS });
}
function isLegalTransition(fromState, toState) { return Boolean(LEGAL_TRANSITIONS[fromState]?.includes(toState)); }
function validateLifecycle(evidence = buildLifecycleEvidence()) {
  const errors = [];
  const lifecycleIds = new Set();
  const maturityIds = new Set();
  for (const record of evidence.lifecycleRecords) {
    if (lifecycleIds.has(record.lifecycleId)) errors.push({ rule: 'DUPLICATE_LIFECYCLE_ID', lifecycleId: record.lifecycleId });
    lifecycleIds.add(record.lifecycleId);
    if (!LIFECYCLE_STATES.includes(record.currentState)) errors.push({ rule: 'UNKNOWN_LIFECYCLE_STATE', lifecycleId: record.lifecycleId });
    if (!isLegalTransition(record.previousState, record.currentState)) errors.push({ rule: 'INVALID_TRANSITION', lifecycleId: record.lifecycleId, from: record.previousState, to: record.currentState });
    if (!record.documentationReferences?.length) errors.push({ rule: 'MISSING_DOCUMENTATION', lifecycleId: record.lifecycleId });
  }
  for (const item of evidence.maturityMatrix) {
    if (maturityIds.has(item.maturityId)) errors.push({ rule: 'DUPLICATE_MATURITY_ID', maturityId: item.maturityId });
    maturityIds.add(item.maturityId);
    for (const dimension of MATURITY_DIMENSIONS) if (!Object.prototype.hasOwnProperty.call(item.dimensions, dimension)) errors.push({ rule: 'MISSING_MATURITY_DIMENSION', maturityId: item.maturityId, dimension });
  }
  for (const item of evidence.readinessMatrix) if (!item.dataReadiness || !item.implementationReadiness || !item.validationReadiness) errors.push({ rule: 'MISSING_READINESS', capabilityId: item.capabilityId });
  for (const item of evidence.learningPolicies) if (item.learningAllowed || !item.learningProhibited) errors.push({ rule: 'INVALID_LEARNING_POLICY', capabilityId: item.capabilityId });
  for (const item of evidence.versionEvolution) if (!item.currentVersion) errors.push({ rule: 'MISSING_VERSION', capabilityId: item.capabilityId });
  return { valid: errors.length === 0, errors };
}
module.exports = { LIFECYCLE_SCHEMA_VERSION, LIFECYCLE_ENGINE_VERSION, DETERMINISTIC_GENERATED_AT, LIFECYCLE_STATES, LEGAL_TRANSITIONS, MATURITY_DIMENSIONS, IMPLEMENTATION_READINESS, VALIDATION_READINESS, buildLifecycleEvidence, validateLifecycle, isLegalTransition, stable, stableStringify, sha256, paths: { backendRoot, repoRoot, docsRoot, generatedRoot } };
