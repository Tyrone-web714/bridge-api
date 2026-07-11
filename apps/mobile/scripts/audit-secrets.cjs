const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SECRET_PATTERNS = [
  { name: 'Google API key', regex: /AIza[0-9A-Za-z_-]{20,}/g },
  { name: 'AWS access key id', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Long bearer-like token', regex: /\b(?:sk|pk|rk|ghp|gho|ghu|ghs)_[0-9A-Za-z_-]{24,}\b/g }
];
const IGNORE_DIRS = new Set([
  '.expo',
  '.expo-export-check',
  '.git',
  'android',
  'coverage',
  'dist',
  'ios',
  'node_modules',
  'web-build'
]);
const IGNORE_FILES = new Set([
  '.env',
  '.env.local',
  'package-lock.json'
]);
const ALLOWLIST_PATTERNS = [
  /restricted-android-maps-sdk-key/i,
  /match-the-backend-driver-api-token/i
];

function shouldSkip(fullPath) {
  const relative = path.relative(ROOT, fullPath).replace(/\\/g, '/');
  const parts = relative.split('/');
  if (parts.some((part) => IGNORE_DIRS.has(part))) return true;
  if (IGNORE_FILES.has(path.basename(fullPath))) return true;
  if (/\.env(\.|$)/.test(path.basename(fullPath))) return true;
  if (/\.(png|jpg|jpeg|webp|gif|zip|pdf|hbc)$/i.test(fullPath)) return true;
  return false;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (shouldSkip(fullPath)) continue;
    if (entry.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function isAllowed(match) {
  return ALLOWLIST_PATTERNS.some((pattern) => pattern.test(match));
}

const findings = [];
for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of SECRET_PATTERNS) {
    const matches = text.match(pattern.regex) || [];
    for (const match of matches) {
      if (isAllowed(match)) continue;
      const line = text.slice(0, text.indexOf(match)).split(/\r?\n/).length;
      findings.push({
        file: path.relative(ROOT, file),
        line,
        type: pattern.name
      });
    }
  }
}

if (findings.length) {
  console.error('Secret audit failed: possible live secrets found in source files.');
  for (const finding of findings) {
    console.error(`- ${finding.type}: ${finding.file}:${finding.line}`);
  }
  process.exit(1);
}

console.log('Secret audit passed.');
