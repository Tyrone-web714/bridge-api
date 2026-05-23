require('dotenv').config();

const DEFAULT_BASE_URL = `http://127.0.0.1:${process.env.PORT || 5000}`;
const BASE_URL = String(process.env.HEALTHCHECK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const TIMEOUT_MS = Number.parseInt(process.env.HEALTHCHECK_TIMEOUT_MS, 10) || 8000;

async function fetchJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, { signal: controller.signal });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text.slice(0, 300) };
    }
    return { response, data };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`${path} timed out after ${TIMEOUT_MS}ms`);
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

async function main() {
  console.log(`[runtime] checking ${BASE_URL}`);

  const health = await fetchJson('/health');
  if (!health.response.ok || !health.data.ok) {
    throw new Error(`/health failed with HTTP ${health.response.status}`);
  }

  console.log('[runtime] /health OK');
  console.log(`  database: ${health.data.database}`);
  console.log(`  postgis: ${Boolean(health.data.postgis)}`);
  const healthStorageConfigured = health.data.photoStorage?.configured;
  console.log(`  photoStorage: ${health.data.photoStorage?.provider || 'unknown'} configured=${healthStorageConfigured === undefined ? 'unknown' : Boolean(healthStorageConfigured)}`);
  console.log(`  driverAuth: ${health.data.driverAuth}`);

  const ready = await fetchJson('/ready');
  console.log(`[runtime] /ready HTTP ${ready.response.status}`);
  printChecks(ready.data.checks);

  if (!ready.response.ok || !ready.data.ok) {
    if (ready.data.databaseError) {
      console.log(`  databaseError: ${ready.data.databaseError}`);
    }
    const storageIssues = ready.data.photoStorage?.issues || [];
    for (const issue of storageIssues) {
      console.log(`  photoStorageIssue: ${issue}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('[runtime] backend is ready.');
}

main().catch((error) => {
  console.error(`[runtime] failed: ${error.message}`);
  process.exitCode = 1;
});
