#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dashboards = require('../services/intelligenceExecution/dashboardDataGeneration');

const outDir = dashboards.paths.dashboardDataRoot;
const generatedHeader = 'Generated from bridge-api/dashboard-data-generation. Do not hand-edit.';

function ensureDir() { fs.mkdirSync(outDir, { recursive: true }); }
function json(value) { return `${JSON.stringify(dashboards.stable(value), null, 2)}\n`; }
function csvEscape(value) {
  const text = Array.isArray(value) ? value.join('|') : typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function csv(rows, fields) {
  return [`# ${generatedHeader}`, fields.join(',')].concat(rows.map((row) => fields.map((field) => csvEscape(row[field])).join(','))).join('\n') + '\n';
}
function writeIfChanged(name, content, options = {}) {
  const file = path.join(outDir, name);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const changed = existing !== content;
  if (changed && !options.check) fs.writeFileSync(file, content, 'utf8');
  return changed;
}
function summaryMd(catalog, validation) {
  return [
    `<!-- ${generatedHeader} -->`,
    '# Dashboard Data Summary',
    '',
    'Dashboard data artifacts are repository-only, deterministic, offline, provider-neutral, database-neutral, read-only, and test-only. They do not build UI, expose APIs, invoke providers, change decisions, approve governance, perform routing, write databases, deploy, migrate, or alter runtime behavior.',
    '',
    `- Dashboard count: ${catalog.length}`,
    `- Schema version: ${dashboards.DASHBOARD_SCHEMA_VERSION}`,
    `- Engine version: ${dashboards.DASHBOARD_ENGINE_VERSION}`,
    `- Deterministic generatedAt: ${dashboards.DETERMINISTIC_GENERATED_AT}`,
    `- Validation: ${validation.valid ? 'valid' : 'invalid'}`,
    '',
    '| Dashboard | File | Hash |',
    '| --- | --- | --- |',
    ...catalog.map((item) => `| ${item.dashboardId} | ${item.fileName} | ${item.generationHash} |`)
  ].join('\n') + '\n';
}
function generate(options = {}) {
  ensureDir();
  const datasets = dashboards.buildDashboards();
  const catalog = dashboards.buildCatalog(datasets);
  const validation = dashboards.validateDashboards(datasets);
  const outputs = {
    'dashboard_catalog.json': json({ generatedArtifact: true, catalog }),
    'dashboard_catalog.csv': csv(catalog, ['dashboardId', 'dashboardTitle', 'dashboardVersion', 'schemaVersion', 'generatedAt', 'sourceSubsystems', 'generationHash', 'testOnly', 'productionApplicable', 'fileName']),
    'dashboard_summary.md': summaryMd(catalog, validation),
    'dashboard_hashes.json': json({ generatedArtifact: true, schemaVersion: dashboards.DASHBOARD_SCHEMA_VERSION, hashes: dashboards.dashboardHashes(datasets), validation })
  };
  for (const dataset of datasets) outputs[dashboards.fileNameFor(dataset.dashboardId)] = json({ generatedArtifact: true, dashboard: dataset });
  const changed = Object.entries(outputs).filter(([name, content]) => writeIfChanged(name, content, options)).map(([name]) => name);
  if (options.check && changed.length) {
    console.error(`[dashboard-data] generated artifacts are stale: ${changed.join(', ')}`);
    process.exitCode = 1;
  } else if (!options.check) {
    console.log(`[dashboard-data] generated ${Object.keys(outputs).length} artifacts in dashboard-data`);
  }
  return { changed, datasets, catalog, validation };
}

if (require.main === module) generate({ check: process.argv.includes('--check') });
module.exports = { generate };
