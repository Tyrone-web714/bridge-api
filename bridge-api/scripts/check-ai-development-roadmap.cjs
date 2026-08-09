#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { generate, paths, stable } = require('./generate-ai-development-roadmap-artifacts.cjs');

const STATUSES = new Set(['PLANNED','APPROVED','IN_PROGRESS','IMPLEMENTED_UNCOMMITTED','COMMITTED_LOCAL','PUSHED','VALIDATED','BLOCKED','DEFERRED','CANCELLED']);
const CATEGORIES = new Set(['AI_PLATFORM_FOUNDATION','CORE_OPERATIONAL_INTELLIGENCE','MODEL_SELECTION_AND_BENCHMARKING','PRODUCTION_ORCHESTRATION','PRODUCTION_OPTIMIZATION','DEVELOPMENT_WORKFLOW']);
const REQUIRED_FILES = [
  'README.md',
  'TSR_AI_MASTER_ROADMAP.md',
  'TSR_AI_MASTER_ROADMAP.json',
  'CURRENT_AI_WORK_PACKAGE.md',
  'CURRENT_AI_WORK_PACKAGE.json',
  'CODEX_COMPLETION_REPORT_TEMPLATE.md',
  'CHATGPT_HANDOFF_PROTOCOL.md',
  'SCOPE_CONTROL_POLICY.md',
  'SCOPE_CHANGE_PROPOSAL_TEMPLATE.md',
  'AI_MODEL_SELECTION_GATE.md',
  'PRODUCTION_ORCHESTRATION_GATE.md',
  'SOURCE_CONTROL_POLICY.md',
  'WORK_PACKAGE_TEMPLATE.md',
  'ROADMAP_STATUS_RULES.md',
  'IMPLEMENTATION_REPORT.md',
  'TEST_PLAN.md',
  'TEST_RESULTS.md',
  'ROLLBACK_PLAN.md'
];
const REQUIRED_FIELDS = [
  'packageId',
  'title',
  'category',
  'status',
  'objective',
  'approvedScope',
  'prohibitedScope',
  'dependencies',
  'acceptanceCriteria',
  'requiredTests',
  'documentationPath',
  'implementationCommit',
  'localCommitVerified',
  'remoteCommitVerified',
  'pushed',
  'deployed',
  'deploymentVerified',
  'migrationRequired',
  'migrationExecuted',
  'productionImpact',
  'ownerApprovalRequired',
  'scopeChangeApprovalRequired',
  'nextApprovedPackage',
  'notes'
];
const CURRENT_REQUIRED = [
  'packageId',
  'title',
  'category',
  'status',
  'objective',
  'approvedScope',
  'prohibitedScope',
  'dependencies',
  'acceptanceCriteria',
  'requiredTests',
  'sourceControlExpectation',
  'expectedCompletionReportFormat',
  'recommendedCommitMessage',
  'nextApprovedPackage',
  'ownerDecisionPoints'
];
const ALLOWED_MILESTONE_ONE = new Set([
  'AI-IEP-005B.1',
  'AI-IEP-005B.2',
  'SUPERVISOR_INTELLIGENCE',
  'WAREHOUSE_INTELLIGENCE',
  'FLEET_INTELLIGENCE',
  'CUSTOMER_INTELLIGENCE',
  'OPERATIONS_INTELLIGENCE',
  'SAFETY_INTELLIGENCE'
]);
const SUPERVISOR_COMMIT = 'e0a9502c9d6134c66c6a9e46926956282fa5d7ff';
const REMOTE_VERIFIED_PACKAGES = ['AI-IEP-005B.1', 'AI-IEP-005B.2', 'SUPERVISOR_INTELLIGENCE', 'TSR-AI-WORKFLOW-001'];

function read(name) {
  return fs.readFileSync(path.join(paths.docsRoot, name), 'utf8');
}

function readJson(name) {
  return JSON.parse(read(name));
}

function assertValidationFails(mutator, expectedRule) {
  const roadmap = readJson('TSR_AI_MASTER_ROADMAP.json');
  const current = readJson('CURRENT_AI_WORK_PACKAGE.json');
  mutator(roadmap, current);
  const failures = validateRoadmap(roadmap, current, { skipGit: true });
  assert.ok(failures.some((failure) => failure.rule === expectedRule), `expected ${expectedRule}, got ${JSON.stringify(failures, null, 2)}`);
}

function git(args) {
  return execFileSync('git', args, { cwd: paths.repoRoot, encoding: 'utf8' }).trim();
}

function remoteContains(commit) {
  if (!commit) return false;
  return git(['branch', '-r', '--contains', commit]).split(/\r?\n/).some((line) => line.trim() === 'origin/legacy-public-url-final-cleanup');
}

function validateRoadmap(roadmap, current, options = {}) {
  const failures = [];
  const packages = roadmap.packages || [];
  const ids = new Set();
  const duplicateIds = new Set();
  for (const pkg of packages) {
    if (ids.has(pkg.packageId)) duplicateIds.add(pkg.packageId);
    ids.add(pkg.packageId);
  }
  for (const id of duplicateIds) failures.push({ rule: 'DUPLICATE_PACKAGE_ID', packageId: id });
  for (const pkg of packages) {
    for (const field of REQUIRED_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(pkg, field)) failures.push({ rule: 'MISSING_REQUIRED_FIELD', packageId: pkg.packageId, field });
    }
    if (!STATUSES.has(pkg.status)) failures.push({ rule: 'UNKNOWN_STATUS', packageId: pkg.packageId, status: pkg.status });
    if (!CATEGORIES.has(pkg.category)) failures.push({ rule: 'UNKNOWN_CATEGORY', packageId: pkg.packageId, category: pkg.category });
    for (const dep of pkg.dependencies || []) {
      if (!ids.has(dep)) failures.push({ rule: 'UNKNOWN_DEPENDENCY', packageId: pkg.packageId, dependency: dep });
    }
    if (!Array.isArray(pkg.approvedScope) || !pkg.approvedScope.length) failures.push({ rule: 'MISSING_APPROVED_SCOPE', packageId: pkg.packageId });
    if (!Array.isArray(pkg.prohibitedScope) || !pkg.prohibitedScope.length) failures.push({ rule: 'MISSING_PROHIBITED_SCOPE', packageId: pkg.packageId });
    if (!Array.isArray(pkg.acceptanceCriteria) || !pkg.acceptanceCriteria.length) failures.push({ rule: 'MISSING_ACCEPTANCE_CRITERIA', packageId: pkg.packageId });
    if (pkg.pushed === true && pkg.remoteCommitVerified !== true) failures.push({ rule: 'FALSE_PUSHED_STATE', packageId: pkg.packageId });
    if (pkg.status === 'PUSHED' && pkg.pushed !== true) failures.push({ rule: 'FALSE_PUSHED_STATE', packageId: pkg.packageId });
    if (pkg.remoteCommitVerified === true && pkg.pushed !== true) failures.push({ rule: 'REMOTE_VERIFIED_WITHOUT_PUSHED_STATE', packageId: pkg.packageId });
    if (pkg.deployed === true && (!pkg.deploymentVerified || pkg.productionImpact !== 'DEPLOYMENT_VERIFIED')) failures.push({ rule: 'FALSE_DEPLOYED_STATE', packageId: pkg.packageId });
    if (pkg.status === 'VALIDATED' && (!Array.isArray(pkg.requiredTests) || !pkg.requiredTests.length)) failures.push({ rule: 'VALIDATED_WITHOUT_TEST_EVIDENCE', packageId: pkg.packageId });
    if (pkg.migrationExecuted === true && pkg.migrationRequired !== true) failures.push({ rule: 'FALSE_MIGRATION_STATE', packageId: pkg.packageId });
  }
  const currentPackages = packages.filter((pkg) => pkg.isCurrentPackage === true);
  if (currentPackages.length !== 1) failures.push({ rule: 'CURRENT_PACKAGE_COUNT', count: currentPackages.length });
  for (const field of CURRENT_REQUIRED) {
    if (!Object.prototype.hasOwnProperty.call(current, field)) failures.push({ rule: 'CURRENT_PACKAGE_MISSING_FIELD', field });
  }
  const currentRoadmap = packages.find((pkg) => pkg.packageId === current.packageId);
  if (!currentRoadmap) failures.push({ rule: 'CURRENT_PACKAGE_NOT_IN_ROADMAP', packageId: current.packageId });
  if (currentRoadmap && currentRoadmap.title !== current.title) failures.push({ rule: 'CURRENT_PACKAGE_JSON_ROADMAP_MISMATCH', packageId: current.packageId });
  if (currentRoadmap && currentRoadmap.status !== current.status) failures.push({ rule: 'CURRENT_PACKAGE_STATUS_MISMATCH', packageId: current.packageId });
  if (current.packageId !== 'WAREHOUSE_INTELLIGENCE') failures.push({ rule: 'CURRENT_PACKAGE_NOT_WAREHOUSE_INTELLIGENCE', packageId: current.packageId });
  if (current.status !== 'APPROVED') failures.push({ rule: 'CURRENT_WAREHOUSE_STATUS_INVALID', status: current.status });
  const currentMarkdown = read('CURRENT_AI_WORK_PACKAGE.md');
  if (!currentMarkdown.includes(`Package ID: ${current.packageId}`) || !currentMarkdown.includes(`Status: ${current.status}`)) failures.push({ rule: 'CURRENT_PACKAGE_MARKDOWN_JSON_MISMATCH' });
  for (const pkg of packages.filter((record) => record.category === 'CORE_OPERATIONAL_INTELLIGENCE')) {
    if (!ALLOWED_MILESTONE_ONE.has(pkg.packageId)) failures.push({ rule: 'UNAPPROVED_MILESTONE_ONE_DOMAIN', packageId: pkg.packageId });
  }
  if (!read('AI_MODEL_SELECTION_GATE.md').includes('Route Intelligence') || !read('AI_MODEL_SELECTION_GATE.md').includes('Premium hosted models')) failures.push({ rule: 'MODEL_SELECTION_GATE_MISSING' });
  if (roadmap.gates?.modelSelection?.complete !== false || roadmap.gates?.modelSelection?.status !== 'DEFERRED') failures.push({ rule: 'MODEL_SELECTION_GATE_FALSE_COMPLETE' });
  if (!read('PRODUCTION_ORCHESTRATION_GATE.md').includes('shadow-mode validation') || !read('PRODUCTION_ORCHESTRATION_GATE.md').includes('owner approval')) failures.push({ rule: 'PRODUCTION_ORCHESTRATION_GATE_MISSING' });
  if (roadmap.gates?.productionOrchestration?.complete !== false || roadmap.gates?.productionOrchestration?.status !== 'DEFERRED') failures.push({ rule: 'PRODUCTION_ORCHESTRATION_FALSE_ACTIVE' });
  const supervisor = packages.find((pkg) => pkg.packageId === 'SUPERVISOR_INTELLIGENCE');
  if (supervisor && supervisor.status !== 'PUSHED') failures.push({ rule: 'SUPERVISOR_PUSHED_MARKED_UNCOMMITTED', status: supervisor.status });
  if (supervisor && supervisor.implementationCommit !== SUPERVISOR_COMMIT) failures.push({ rule: 'SUPERVISOR_COMMIT_MISMATCH', implementationCommit: supervisor.implementationCommit });
  if (supervisor && (supervisor.localCommitVerified !== true || supervisor.remoteCommitVerified !== true || supervisor.pushed !== true)) failures.push({ rule: 'SUPERVISOR_PUSH_EVIDENCE_MISSING' });
  if (supervisor && (supervisor.deployed || supervisor.deploymentVerified || supervisor.migrationExecuted || supervisor.productionImpact !== 'REPOSITORY_ONLY_FOUNDATION')) failures.push({ rule: 'SUPERVISOR_FALSE_PRODUCTION_STATE' });
  const warehouse = packages.find((pkg) => pkg.packageId === 'WAREHOUSE_INTELLIGENCE');
  if (warehouse && warehouse.status !== 'APPROVED') failures.push({ rule: 'WAREHOUSE_STATUS_INVALID', status: warehouse.status });
  if (warehouse && (['IMPLEMENTED_UNCOMMITTED','COMMITTED_LOCAL','PUSHED','VALIDATED'].includes(warehouse.status) || warehouse.implementationCommit || warehouse.localCommitVerified || warehouse.remoteCommitVerified || warehouse.pushed || warehouse.deployed || warehouse.migrationExecuted)) failures.push({ rule: 'WAREHOUSE_IMPLEMENTED_WITHOUT_EVIDENCE' });
  if (warehouse && warehouse.packageId !== 'WAREHOUSE_INTELLIGENCE') failures.push({ rule: 'WAREHOUSE_PACKAGE_NUMBER_FABRICATED', packageId: warehouse.packageId });
  for (const pkg of packages) {
    if (pkg.title === 'Warehouse Intelligence' && pkg.packageId !== 'WAREHOUSE_INTELLIGENCE') failures.push({ rule: 'WAREHOUSE_PACKAGE_NUMBER_FABRICATED', packageId: pkg.packageId });
  }
  const scopePolicy = read('SCOPE_CONTROL_POLICY.md');
  for (const phrase of ['No new feature enters implementation without owner approval', 'Supervisor Intelligence implementation requires an owner-approved work package', 'Roadmap status changes require evidence']) {
    if (!scopePolicy.includes(phrase)) failures.push({ rule: 'SCOPE_CONTROL_POLICY_INCOMPLETE', phrase });
  }
  const proposal = read('SCOPE_CHANGE_PROPOSAL_TEMPLATE.md');
  for (const phrase of ['proposal ID', 'owner decision', 'REQUEST_MORE_INFORMATION', 'approval evidence']) {
    if (!proposal.includes(phrase)) failures.push({ rule: 'SCOPE_CHANGE_TEMPLATE_INCOMPLETE', phrase });
  }
  const report = read('CODEX_COMPLETION_REPORT_TEMPLATE.md');
  for (const label of ['A. Work package ID and title', 'AN. Suggested commit message', 'whether Codex remained within approved scope', 'whether the next package is already approved']) {
    if (!report.includes(label)) failures.push({ rule: 'COMPLETION_REPORT_TEMPLATE_INCOMPLETE', label });
  }
  const handoff = read('CHATGPT_HANDOFF_PROTOCOL.md');
  if (!handoff.includes('There is no automatic live connection') || !handoff.includes('GitHub and the standardized completion report are the approved handoff mechanism')) failures.push({ rule: 'AUTOMATIC_CONNECTION_CLAIM_OR_MISSING_DENIAL' });
  if (!read('SOURCE_CONTROL_POLICY.md').includes('no force-push') || !read('SOURCE_CONTROL_POLICY.md').includes('owner approval before push')) failures.push({ rule: 'SOURCE_CONTROL_POLICY_INCOMPLETE' });
  if (!options.skipGit) {
    const verifiedPackages = REMOTE_VERIFIED_PACKAGES.map((id) => packages.find((pkg) => pkg.packageId === id));
    for (const pkg of verifiedPackages) {
      if (!pkg) continue;
      const localExists = Boolean(git(['cat-file', '-e', `${pkg.implementationCommit}^{commit}`]) === '');
      if (pkg.localCommitVerified !== localExists) failures.push({ rule: 'LOCAL_COMMIT_VERIFICATION_MISMATCH', packageId: pkg.packageId });
      const remoteHas = remoteContains(pkg.implementationCommit);
      if (pkg.remoteCommitVerified !== remoteHas || pkg.pushed !== remoteHas) failures.push({ rule: 'REMOTE_COMMIT_VERIFICATION_MISMATCH', packageId: pkg.packageId, remoteHas });
    }
  }
  return failures;
}

function main() {
  for (const file of REQUIRED_FILES) assert.ok(fs.existsSync(path.join(paths.docsRoot, file)), `missing required file ${file}`);
  const roadmap = readJson('TSR_AI_MASTER_ROADMAP.json');
  const current = readJson('CURRENT_AI_WORK_PACKAGE.json');
  assert.ok(Array.isArray(roadmap.packages), 'roadmap packages must be an array');
  assert.deepStrictEqual(new Set(roadmap.controlledStatuses), STATUSES);
  assert.deepStrictEqual(new Set(roadmap.controlledCategories), CATEGORIES);
  const failures = validateRoadmap(roadmap, current);
  assert.deepStrictEqual(failures, []);
  assertValidationFails((roadmap) => { roadmap.packages.push({ ...roadmap.packages[0] }); }, 'DUPLICATE_PACKAGE_ID');
  assertValidationFails((roadmap) => { roadmap.packages[0].status = 'DONE'; }, 'UNKNOWN_STATUS');
  assertValidationFails((roadmap) => { roadmap.packages[0].category = 'NEW_CATEGORY'; }, 'UNKNOWN_CATEGORY');
  assertValidationFails((roadmap) => { roadmap.packages[0].dependencies = ['UNKNOWN_PACKAGE']; }, 'UNKNOWN_DEPENDENCY');
  assertValidationFails((roadmap) => { delete roadmap.packages[0].objective; }, 'MISSING_REQUIRED_FIELD');
  assertValidationFails((roadmap) => { roadmap.packages[1].isCurrentPackage = true; }, 'CURRENT_PACKAGE_COUNT');
  assertValidationFails((roadmap) => { roadmap.packages = roadmap.packages.filter((pkg) => !pkg.isCurrentPackage); }, 'CURRENT_PACKAGE_COUNT');
  assertValidationFails((roadmap, current) => { current.packageId = 'MISSING_CURRENT'; }, 'CURRENT_PACKAGE_NOT_IN_ROADMAP');
  assertValidationFails((roadmap, current) => { current.status = 'PLANNED'; }, 'CURRENT_PACKAGE_STATUS_MISMATCH');
  assertValidationFails((roadmap) => { roadmap.packages[0].approvedScope = []; }, 'MISSING_APPROVED_SCOPE');
  assertValidationFails((roadmap) => { roadmap.packages[0].prohibitedScope = []; }, 'MISSING_PROHIBITED_SCOPE');
  assertValidationFails((roadmap) => { roadmap.packages[0].acceptanceCriteria = []; }, 'MISSING_ACCEPTANCE_CRITERIA');
  assertValidationFails((roadmap) => { roadmap.packages.push({ ...roadmap.packages[0], packageId: 'MAINTENANCE_INTELLIGENCE', title: 'Maintenance Intelligence', category: 'CORE_OPERATIONAL_INTELLIGENCE', dependencies: [] }); }, 'UNAPPROVED_MILESTONE_ONE_DOMAIN');
  assertValidationFails((roadmap) => { const route = roadmap.packages.find((pkg) => pkg.packageId === 'AI-IEP-005B.1'); route.pushed = true; route.remoteCommitVerified = false; }, 'FALSE_PUSHED_STATE');
  assertValidationFails((roadmap) => { roadmap.packages[0].deployed = true; roadmap.packages[0].deploymentVerified = false; }, 'FALSE_DEPLOYED_STATE');
  assertValidationFails((roadmap) => { roadmap.packages.find((pkg) => pkg.packageId === 'TSR-AI-WORKFLOW-001').isCurrentPackage = true; }, 'CURRENT_PACKAGE_COUNT');
  assertValidationFails((roadmap) => { const supervisor = roadmap.packages.find((pkg) => pkg.packageId === 'SUPERVISOR_INTELLIGENCE'); supervisor.status = 'IMPLEMENTED_UNCOMMITTED'; }, 'SUPERVISOR_PUSHED_MARKED_UNCOMMITTED');
  assertValidationFails((roadmap) => { const supervisor = roadmap.packages.find((pkg) => pkg.packageId === 'SUPERVISOR_INTELLIGENCE'); supervisor.deployed = true; supervisor.deploymentVerified = true; supervisor.productionImpact = 'DEPLOYMENT_VERIFIED'; }, 'SUPERVISOR_FALSE_PRODUCTION_STATE');
  assertValidationFails((roadmap) => { const warehouse = roadmap.packages.find((pkg) => pkg.packageId === 'WAREHOUSE_INTELLIGENCE'); warehouse.status = 'PUSHED'; warehouse.implementationCommit = '1234567'; }, 'WAREHOUSE_IMPLEMENTED_WITHOUT_EVIDENCE');
  assertValidationFails((roadmap, current) => {
    const warehouse = roadmap.packages.find((pkg) => pkg.packageId === 'WAREHOUSE_INTELLIGENCE');
    warehouse.packageId = 'AI-IEP-005B.3';
    current.packageId = 'AI-IEP-005B.3';
  }, 'WAREHOUSE_PACKAGE_NUMBER_FABRICATED');
  assertValidationFails((roadmap) => { roadmap.gates.modelSelection.complete = true; roadmap.gates.modelSelection.status = 'APPROVED'; }, 'MODEL_SELECTION_GATE_FALSE_COMPLETE');
  assertValidationFails((roadmap) => { roadmap.gates.productionOrchestration.complete = true; roadmap.gates.productionOrchestration.status = 'IN_PROGRESS'; }, 'PRODUCTION_ORCHESTRATION_FALSE_ACTIVE');
  const before = fs.readdirSync(paths.generatedRoot).sort().map((name) => [name, fs.readFileSync(path.join(paths.generatedRoot, name), 'utf8')]);
  const generated = generate({ check: true });
  assert.deepStrictEqual(generated.changed, []);
  const after = fs.readdirSync(paths.generatedRoot).sort().map((name) => [name, fs.readFileSync(path.join(paths.generatedRoot, name), 'utf8')]);
  assert.deepStrictEqual(after, before);
  assert.deepStrictEqual(stable({ b: 1, a: 2 }), { a: 2, b: 1 });
  console.log('[test:ai-roadmap] roadmap records, status/category controls, dependency rules, current package, handoff protocol, GitHub workflow, gates, source-control policy, generated summaries, and negative validation cases verified.');
}

if (require.main === module) main();
module.exports = { validateRoadmap };
