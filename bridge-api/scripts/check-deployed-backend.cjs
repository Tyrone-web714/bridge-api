require('dotenv').config();

const DEFAULT_TIMEOUT_MS = 12000;

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getBaseUrl() {
  const fromArg = process.argv[2];
  const fromEnv = process.env.DEPLOYED_BACKEND_URL || process.env.BACKEND_PUBLIC_URL;
  return normalizeBaseUrl(fromArg || fromEnv);
}

async function fetchJson(baseUrl, path, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text.slice(0, 500) };
    }
    return { response, data };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`${path} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function printChecks(checks = {}) {
  for (const [name, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? 'OK ' : 'BAD'} ${name}`);
  }
}

function printStorageStatus(storage = {}) {
  console.log(`  provider: ${storage.provider || 'unknown'}`);
  console.log(`  configured: ${Boolean(storage.configured)}`);
  console.log(`  durable: ${Boolean(storage.durable)}`);
  for (const issue of storage.issues || []) {
    console.log(`  issue: ${issue}`);
  }
}

async function main() {
  const baseUrl = getBaseUrl();
  const timeoutMs = Number.parseInt(process.env.DEPLOYED_BACKEND_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS;

  if (!baseUrl) {
    console.error('Deployed backend URL is required.');
    console.error('Use one of these:');
    console.error('  npm.cmd run check:deployed -- https://your-api-host.example');
    console.error('  $env:DEPLOYED_BACKEND_URL="https://your-api-host.example"; npm.cmd run check:deployed');
    process.exit(1);
  }

  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1') || baseUrl.includes('192.168.')) {
    console.error(`Refusing deployed check against local/private URL: ${baseUrl}`);
    console.error('Use npm.cmd run check:runtime for local backend checks.');
    process.exit(1);
  }

  console.log(`[deploy] checking ${baseUrl}`);

  const health = await fetchJson(baseUrl, '/health', timeoutMs);
  console.log(`[deploy] /health HTTP ${health.response.status}`);
  if (!health.response.ok || !health.data.ok) {
    throw new Error('/health did not report ok=true');
  }
  console.log(`  database: ${health.data.database}`);
  console.log(`  postgis: ${Boolean(health.data.postgis)}`);
  console.log(`  driverAuth: ${health.data.driverAuth || 'unknown'}`);
  console.log('  photoStorage:');
  printStorageStatus(health.data.photoStorage);

  const ready = await fetchJson(baseUrl, '/ready', timeoutMs);
  console.log(`[deploy] /ready HTTP ${ready.response.status}`);
  printChecks(ready.data.checks);

  if (!ready.response.ok || !ready.data.ok) {
    if (ready.data.databaseError) {
      console.log(`  databaseError: ${ready.data.databaseError}`);
    }
    printStorageStatus(ready.data.photoStorage);
    process.exit(1);
  }

  console.log('[deploy] deployed backend is ready for the mobile app.');
}

main().catch((error) => {
  console.error(`[deploy] failed: ${error.message}`);
  process.exit(1);
});
