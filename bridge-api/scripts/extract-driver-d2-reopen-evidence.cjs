#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const reopen = require('./driver-d2-model-reopen.cjs');

function decodeCapture(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.slice(2).toString('utf16le');
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) throw new Error('UTF-16BE evidence capture is not supported.');
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return buffer.slice(3).toString('utf8');
  return buffer.toString('utf8');
}

function findJsonObject(text) {
  const schemaIndex = text.indexOf(reopen.EVIDENCE_SCHEMA_VERSION);
  if (schemaIndex === -1) throw new Error(`Evidence schema ${reopen.EVIDENCE_SCHEMA_VERSION} was not found.`);
  const starts = [];
  for (let index = 0; index < schemaIndex; index += 1) {
    if (text[index] === '{') starts.push(index);
  }
  for (const start of starts) {
    const candidate = findJsonObjectFromStart(text, start);
    if (!candidate || !candidate.includes(reopen.EVIDENCE_SCHEMA_VERSION)) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed?.schemaVersion === reopen.EVIDENCE_SCHEMA_VERSION && Array.isArray(parsed.results)) return candidate;
    } catch {
      // Try the next brace candidate.
    }
  }
  throw new Error('Could not locate validated Driver reopen evidence JSON object.');
}

function findJsonObjectFromStart(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function extractEvidence({ inputPath, outputPath }) {
  const input = path.resolve(process.cwd(), inputPath);
  const output = path.resolve(process.cwd(), outputPath);
  const decoded = decodeCapture(fs.readFileSync(input));
  const evidence = JSON.parse(findJsonObject(decoded));
  const validation = reopen.validateEvidenceRun(evidence);
  if (!validation.valid) throw new Error(`Extracted evidence failed validation: ${validation.errors.join(', ')}`);
  fs.writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return { input, output, validation };
}

function parseArgs(args) {
  const inputArg = args.find((arg) => arg.startsWith('--input='));
  const outputArg = args.find((arg) => arg.startsWith('--output='));
  if (!inputArg || !outputArg) throw new Error('--input=<captured-file> and --output=<clean-json-file> are required.');
  return { inputPath: inputArg.slice('--input='.length), outputPath: outputArg.slice('--output='.length) };
}

function main() {
  try {
    const result = extractEvidence(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({
      extracted: true,
      input: result.input,
      output: result.output,
      schemaVersion: reopen.EVIDENCE_SCHEMA_VERSION,
      summary: result.validation.summary
    }, null, 2));
  } catch (error) {
    console.error(`[driver-d2-evidence-extract] ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  decodeCapture,
  extractEvidence,
  findJsonObject
};
