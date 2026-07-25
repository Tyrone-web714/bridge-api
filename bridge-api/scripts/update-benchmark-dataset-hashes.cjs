#!/usr/bin/env node
const fs = require('fs');
const framework = require('../services/intelligenceExecution/benchmarkDatasetFramework');

function applyHashes(dataset) {
  const clone = framework.stripIntegrityHashes(JSON.parse(JSON.stringify(dataset)));
  for (const testCase of clone.cases || []) {
    testCase.integrity = {
      ...(testCase.integrity || {}),
      contentHash: framework.computeCaseHash(testCase)
    };
  }
  const manifestHash = framework.computeManifestHash(clone);
  clone.integrity = {
    ...(clone.integrity || {}),
    contentHash: manifestHash,
    manifestHash
  };
  return framework.stable(clone);
}

function main() {
  const datasets = framework.loadDatasets();
  for (const dataset of datasets) {
    if (!dataset.__filePath) continue;
    const withHashes = applyHashes(dataset);
    fs.writeFileSync(dataset.__filePath, `${JSON.stringify(withHashes, null, 2)}\n`, 'utf8');
  }
  console.log(`[benchmark-datasets] updated source hashes for ${datasets.length} datasets`);
}

if (require.main === module) main();

module.exports = { applyHashes };
