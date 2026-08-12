#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const docsRoot = path.join(repoRoot, 'docs', 'ai-development');
const generatedRoot = path.join(docsRoot, 'generated');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(docsRoot, name), 'utf8'));
}

function json(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function writeIfChanged(name, content, options = {}) {
  const file = path.join(generatedRoot, name);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(file, content, 'utf8');
  return changed;
}

function packageSummary(pkg) {
  return {
    packageId: pkg.packageId,
    title: pkg.title,
    category: pkg.category,
    status: pkg.status,
    implementationCommit: pkg.implementationCommit,
    localCommitVerified: pkg.localCommitVerified,
    remoteCommitVerified: pkg.remoteCommitVerified,
    pushed: pkg.pushed,
    deployed: pkg.deployed,
    productionImpact: pkg.productionImpact,
    ownerApprovalRequired: pkg.ownerApprovalRequired,
    nextApprovedPackage: pkg.nextApprovedPackage
  };
}

function markdownSummary(roadmap, current) {
  const byCategory = roadmap.packages.reduce((acc, pkg) => {
    acc[pkg.category] = acc[pkg.category] || [];
    acc[pkg.category].push(pkg);
    return acc;
  }, {});
  const lines = [
    '<!-- Generated from docs/ai-development. Do not hand-edit. -->',
    '# TSR AI Roadmap Summary',
    '',
    `- Roadmap ID: ${roadmap.roadmapId}`,
    `- Current package: ${current.packageId} - ${current.title}`,
    `- Current status: ${current.status}`,
    `- Next approved package: ${current.nextApprovedPackage}`,
    `- Route Intelligence pushed: ${Boolean(roadmap.packages.find((pkg) => pkg.packageId === 'AI-IEP-005B.1')?.pushed)}`,
    `- Driver Intelligence pushed: ${Boolean(roadmap.packages.find((pkg) => pkg.packageId === 'AI-IEP-005B.2')?.pushed)}`,
    '',
    '## Package Counts By Category',
    '',
    '| Category | Count |',
    '| --- | ---: |',
    ...Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([category, records]) => `| ${category} | ${records.length} |`),
    '',
    '## Status Counts',
    '',
    '| Status | Count |',
    '| --- | ---: |'
  ];
  const statusCounts = roadmap.packages.reduce((acc, pkg) => {
    acc[pkg.status] = (acc[pkg.status] || 0) + 1;
    return acc;
  }, {});
  lines.push(...Object.entries(statusCounts).sort(([a], [b]) => a.localeCompare(b)).map(([status, count]) => `| ${status} | ${count} |`));
  return `${lines.join('\n')}\n`;
}

function generate(options = {}) {
  fs.mkdirSync(generatedRoot, { recursive: true });
  const roadmap = readJson('TSR_AI_MASTER_ROADMAP.json');
  const current = readJson('CURRENT_AI_WORK_PACKAGE.json');
  const packages = roadmap.packages || [];
  const core = packages.filter((pkg) => pkg.category === 'CORE_OPERATIONAL_INTELLIGENCE');
  const warehouse = packages.find((pkg) => pkg.packageId === 'WAREHOUSE_INTELLIGENCE');
  const fleet = packages.find((pkg) => pkg.packageId === 'FLEET_INTELLIGENCE');
  const customer = packages.find((pkg) => pkg.packageId === 'CUSTOMER_INTELLIGENCE');
  const operations = packages.find((pkg) => pkg.packageId === 'OPERATIONS_INTELLIGENCE');
  const safety = packages.find((pkg) => pkg.packageId === 'SAFETY_INTELLIGENCE');
  const outputs = {
    'ai_roadmap_summary.json': json({
      roadmapId: roadmap.roadmapId,
      controlledStatuses: roadmap.controlledStatuses,
      controlledCategories: roadmap.controlledCategories,
      packageCount: packages.length,
      packages: packages.map(packageSummary)
    }),
    'ai_roadmap_summary.md': markdownSummary(roadmap, current),
    'current_work_package.json': json(current),
    'milestone_progress.json': json({
      coreOperationalIntelligence: core.map(packageSummary),
      modelSelectionGateSatisfied: false,
      productionOrchestrationGateSatisfied: false,
      nextApprovedPackage: current.nextApprovedPackage
    }),
    'source_control_status.json': json({
      localBranch: roadmap.sourceControl.localBranch,
      remoteBranch: roadmap.sourceControl.remoteBranch,
      remoteVerificationPerformed: roadmap.sourceControl.remoteVerificationPerformed,
      remoteHead: roadmap.sourceControl.remoteHead,
      localHead: roadmap.sourceControl.localHead,
      localAheadBy: roadmap.sourceControl.localAheadBy,
      pushedStatusRequiresRemoteContainment: true
    }),
    'scope_control_status.json': json({
      policyPath: 'docs/ai-development/SCOPE_CONTROL_POLICY.md',
      ownerApprovalRequiredForNewIdeas: true,
      supervisorIntelligenceRemoteContained: Boolean(packages.find((pkg) => pkg.packageId === 'SUPERVISOR_INTELLIGENCE')?.pushed),
      warehouseIntelligenceRemoteContained: Boolean(warehouse?.pushed && warehouse?.remoteCommitVerified),
      warehouseImplementationStarted: Boolean(warehouse?.implementationCommit),
      fleetIntelligenceRemoteContained: Boolean(fleet?.pushed && fleet?.remoteCommitVerified),
      fleetIntelligenceMayBegin: false,
      fleetImplementationStarted: Boolean(fleet?.implementationCommit),
      customerIntelligenceRemoteContained: Boolean(customer?.pushed && customer?.remoteCommitVerified),
      customerImplementationStarted: Boolean(customer?.implementationCommit),
      operationsIntelligenceRemoteContained: Boolean(operations?.pushed && operations?.remoteCommitVerified),
      operationsImplementationStarted: Boolean(operations?.implementationCommit),
      safetyIntelligenceApproved: current.packageId === 'SAFETY_INTELLIGENCE' && current.status === 'APPROVED',
      safetyImplementationStarted: Boolean(safety?.implementationCommit),
      unapprovedMilestoneOneDomainsAllowed: false,
      deterministicTruckSafetyControlsAuthoritative: true
    }),
    'model_selection_gate_status.json': json({
      gatePath: 'docs/ai-development/AI_MODEL_SELECTION_GATE.md',
      status: 'DEFERRED',
      complete: false,
      requiredCoreDomains: roadmap.gates.modelSelection.requiredCoreDomains
    }),
    'production_orchestration_gate_status.json': json({
      gatePath: 'docs/ai-development/PRODUCTION_ORCHESTRATION_GATE.md',
      status: 'DEFERRED',
      complete: false,
      authorizedByThisPackage: false,
      requirements: roadmap.gates.productionOrchestration.requirements
    })
  };
  const changed = Object.entries(outputs).filter(([name, content]) => writeIfChanged(name, content, options)).map(([name]) => name);
  if (options.check && changed.length) {
    console.error(`[ai-roadmap] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[ai-roadmap] generated ${Object.keys(outputs).length} artifacts in docs/ai-development/generated`);
  }
  return { changed, roadmap, current };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate, stable, paths: { backendRoot, repoRoot, docsRoot, generatedRoot } };
