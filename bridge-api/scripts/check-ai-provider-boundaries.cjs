const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ACTIVE_DIRS = ['routes', 'services'];
const APPROVED_RELATIVE_FILES = new Set([
  path.normalize('services/aiProvider.js'),
  path.normalize('services/intelligenceExecution/providerAdapters.js')
]);

const PROHIBITED_PATTERNS = [
  {
    name: 'direct aiProvider import',
    regex: /require\(['"][^'"]*aiProvider['"]\)|from\s+['"][^'"]*aiProvider['"]/g
  },
  {
    name: 'direct aiProvider structured execution',
    regex: /aiProvider\.createStructuredResponse\s*\(/g
  },
  {
    name: 'direct OpenAI SDK import',
    regex: /require\(['"]openai['"]\)|from\s+['"]openai['"]/g
  },
  {
    name: 'direct OpenAI API URL',
    regex: /https:\/\/api\.openai\.com/g
  }
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (!entry.isFile() || !/\.(js|cjs|mjs)$/.test(entry.name)) return [];
    return [fullPath];
  });
}

function relative(file) {
  return path.normalize(path.relative(ROOT, file));
}

function scanSource(source, relativePath) {
  if (APPROVED_RELATIVE_FILES.has(relativePath)) return [];
  const violations = [];
  for (const pattern of PROHIBITED_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match = pattern.regex.exec(source);
    while (match) {
      const lineNumber = source.slice(0, match.index).split(/\r?\n/).length;
      violations.push({ file: relativePath, lineNumber, pattern: pattern.name, match: match[0] });
      match = pattern.regex.exec(source);
    }
  }
  return violations;
}

function scanRepository() {
  const files = ACTIVE_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
  return files.flatMap((file) => scanSource(fs.readFileSync(file, 'utf8'), relative(file)));
}

function formatViolations(violations) {
  return violations
    .map((violation) => `${violation.file}:${violation.lineNumber} ${violation.pattern} (${violation.match})`)
    .join('\n');
}

function runControlledFailureCheck() {
  const violations = scanSource("const aiProvider = require('./aiProvider');\naiProvider.createStructuredResponse({});\n", path.normalize('services/prohibitedFixture.js'));
  assert(violations.some((violation) => violation.pattern === 'direct aiProvider import'), 'controlled fixture must catch direct aiProvider import');
  assert(violations.some((violation) => violation.pattern === 'direct aiProvider structured execution'), 'controlled fixture must catch direct aiProvider execution');
}

function run() {
  runControlledFailureCheck();
  const violations = scanRepository();
  if (violations.length) {
    console.error('[test:ai-architecture] prohibited provider bypass detected:');
    console.error(formatViolations(violations));
    process.exit(1);
  }
  console.log('[test:ai-architecture] provider bypass enforcement verified.');
}

run();