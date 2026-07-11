const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const outputDir = path.join(projectRoot, 'compliance');
const projectName = 'tsr-mobile';
const lock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'));

fs.mkdirSync(outputDir, { recursive: true });
const npmCli = process.env.npm_execpath;
const sbom = spawnSync(
  npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm'),
  npmCli
    ? [npmCli, 'sbom', '--sbom-format', 'cyclonedx', '--package-lock-only']
    : ['sbom', '--sbom-format', 'cyclonedx', '--package-lock-only'],
  { cwd: projectRoot, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
);
if (sbom.status !== 0) throw new Error(`npm sbom failed: ${sbom.stderr || sbom.stdout}`);

const packages = Object.entries(lock.packages || {})
  .filter(([packagePath]) => packagePath)
  .map(([packagePath, metadata]) => ({
    name: metadata.name || packagePath.split('node_modules/').pop(),
    version: metadata.version || null,
    license: metadata.license || 'UNKNOWN',
    path: packagePath
  }))
  .sort((left, right) => `${left.name}@${left.version}`.localeCompare(`${right.name}@${right.version}`));

fs.writeFileSync(path.join(outputDir, `${projectName}-sbom.cdx.json`), sbom.stdout);
fs.writeFileSync(
  path.join(outputDir, `${projectName}-licenses.json`),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), projectName, packages }, null, 2)}\n`
);
const noticeRows = packages.map((entry) => (
  `| ${entry.name.replace(/\|/g, '\\|')} | ${entry.version || ''} | ${entry.license.replace(/\|/g, '\\|')} |`
));
fs.writeFileSync(
  path.join(outputDir, `${projectName}-third-party-notices.md`),
  `# ${projectName} Third-Party Package Inventory\n\n` +
  `Generated from package-lock.json. Preserve applicable license texts when distributing binaries.\n\n` +
  `| Package | Version | Declared license |\n| --- | --- | --- |\n${noticeRows.join('\n')}\n`
);
console.log(`[compliance] ${projectName}: ${packages.length} package records`);
