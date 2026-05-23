const fs = require('fs');
const path = require('path');
require('dotenv').config();

const postgres = require('../db/postgres');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EXPECTED_STATES = [
  { code: 'TX', name: 'Texas', south: 25.8, west: -106.7, north: 36.6, east: -93.5 },
  { code: 'OK', name: 'Oklahoma', south: 33.6, west: -103.2, north: 37.2, east: -94.3 },
  { code: 'NM', name: 'New Mexico', south: 31.2, west: -109.1, north: 37.1, east: -103.0 },
  { code: 'AR', name: 'Arkansas', south: 33.0, west: -94.7, north: 36.6, east: -89.6 }
];

function readJsonArray(filename) {
  const fullPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fullPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function inferStateCode(record) {
  const explicit = String(record.state_code || record.stateCode || record.raw?.state_code || record.raw?.stateCode || '')
    .trim()
    .toUpperCase();
  if (EXPECTED_STATES.some((state) => state.code === explicit)) return explicit;

  const lat = Number(record.latitude ?? record.lat);
  const lng = Number(record.longitude ?? record.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'UNKNOWN';

  const match = EXPECTED_STATES.find((state) => (
    lat >= state.south &&
    lat <= state.north &&
    lng >= state.west &&
    lng <= state.east
  ));
  return match ? match.code : 'UNKNOWN';
}

function summarizeJsonRecords() {
  const rows = [];
  const sources = [
    { category: 'low_bridge', records: readJsonArray('low_clearance_bridges.json') },
    { category: 'no_truck', records: readJsonArray('no_truck_zones.json') },
    { category: 'residential', records: readJsonArray('residential_zones.json') }
  ];

  for (const source of sources) {
    const counts = new Map();
    for (const record of source.records) {
      const stateCode = inferStateCode(record);
      counts.set(stateCode, (counts.get(stateCode) || 0) + 1);
    }
    for (const state of EXPECTED_STATES) {
      rows.push({
        source: 'json',
        category: source.category,
        state_code: state.code,
        state_name: state.name,
        active_count: counts.get(state.code) || 0,
        verified_count: 0,
        unverified_count: counts.get(state.code) || 0,
        city_count: 0
      });
    }
    if (counts.get('UNKNOWN')) {
      rows.push({
        source: 'json',
        category: source.category,
        state_code: 'UNKNOWN',
        state_name: 'Unknown',
        active_count: counts.get('UNKNOWN'),
        verified_count: 0,
        unverified_count: counts.get('UNKNOWN'),
        city_count: 0
      });
    }
  }
  return rows;
}

function stateCaseSql(latColumn, lngColumn) {
  const branches = EXPECTED_STATES.map((state) => (
    `WHEN ${latColumn} BETWEEN ${state.south} AND ${state.north} AND ${lngColumn} BETWEEN ${state.west} AND ${state.east} THEN '${state.code}'`
  ));
  return `CASE
    WHEN upper(state_code) IN ('TX', 'OK', 'NM', 'AR') THEN upper(state_code)
    ${branches.join('\n    ')}
    ELSE 'UNKNOWN'
  END`;
}

async function summarizePostgresRecords() {
  await postgres.ensureSchema();
  const bridgeStateSql = stateCaseSql('latitude', 'longitude');
  const zoneStateSql = stateCaseSql('latitude', 'longitude');

  const bridgeResult = await postgres.query(`
    WITH normalized AS (
      SELECT
        ${bridgeStateSql} AS inferred_state_code,
        verification_status,
        location_city
      FROM low_clearance_bridges
      WHERE active = true
        AND verification_status NOT IN ('inactive', 'incorrect')
    )
    SELECT
      'postgres' AS source,
      'low_bridge' AS category,
      inferred_state_code AS state_code,
      count(*)::int AS active_count,
      count(*) FILTER (WHERE verification_status = 'verified')::int AS verified_count,
      count(*) FILTER (WHERE verification_status = 'unverified')::int AS unverified_count,
      count(DISTINCT NULLIF(location_city, ''))::int AS city_count
    FROM normalized
    GROUP BY inferred_state_code
  `);

  const zoneResult = await postgres.query(`
    WITH normalized AS (
      SELECT
        zone_type,
        ${zoneStateSql} AS inferred_state_code,
        verification_status,
        location_city
      FROM truck_restricted_zones
      WHERE zone_type IN ('no_truck', 'residential')
        AND active = true
        AND verification_status NOT IN ('inactive', 'incorrect')
    )
    SELECT
      'postgres' AS source,
      zone_type AS category,
      inferred_state_code AS state_code,
      count(*)::int AS active_count,
      count(*) FILTER (WHERE verification_status = 'verified')::int AS verified_count,
      count(*) FILTER (WHERE verification_status = 'unverified')::int AS unverified_count,
      count(DISTINCT NULLIF(location_city, ''))::int AS city_count
    FROM normalized
    GROUP BY zone_type, inferred_state_code
  `);

  const rowsByKey = new Map();
  for (const row of [...bridgeResult.rows, ...zoneResult.rows]) {
    rowsByKey.set(`${row.category}:${row.state_code}`, row);
  }

  const rows = [];
  for (const category of ['low_bridge', 'no_truck', 'residential']) {
    for (const state of EXPECTED_STATES) {
      const row = rowsByKey.get(`${category}:${state.code}`);
      rows.push({
        source: 'postgres',
        category,
        state_code: state.code,
        state_name: state.name,
        active_count: Number(row?.active_count || 0),
        verified_count: Number(row?.verified_count || 0),
        unverified_count: Number(row?.unverified_count || 0),
        city_count: Number(row?.city_count || 0)
      });
    }
  }

  for (const row of [...bridgeResult.rows, ...zoneResult.rows]) {
    if (row.state_code === 'UNKNOWN') {
      rows.push({
        source: 'postgres',
        category: row.category,
        state_code: 'UNKNOWN',
        state_name: 'Unknown',
        active_count: Number(row.active_count || 0),
        verified_count: Number(row.verified_count || 0),
        unverified_count: Number(row.unverified_count || 0),
        city_count: Number(row.city_count || 0)
      });
    }
  }

  return rows;
}

function buildFindings(rows) {
  const findings = [];
  for (const state of EXPECTED_STATES) {
    for (const category of ['no_truck', 'residential']) {
      const row = rows.find((item) => item.state_code === state.code && item.category === category);
      if (!row || row.active_count === 0) {
        findings.push({
          severity: 'critical',
          state: state.code,
          category,
          message: `${state.name} has no active ${category.replace(/_/g, '-')} records.`
        });
      } else if (row.city_count === 0) {
        findings.push({
          severity: 'warning',
          state: state.code,
          category,
          message: `${state.name} has ${row.active_count} ${category.replace(/_/g, '-')} records, but no city metadata yet.`
        });
      }
    }
  }
  return findings;
}

function printRows(rows, findings) {
  console.log('\nTruck-Safe hazard dataset coverage');
  console.log('Source:', rows[0]?.source || 'unknown');
  console.log('');
  console.table(rows.map((row) => ({
    category: row.category,
    state: row.state_code,
    active: row.active_count,
    verified: row.verified_count,
    unverified: row.unverified_count,
    cities: row.city_count
  })));

  if (!findings.length) {
    console.log('Coverage audit passed: all four service states have no-truck and residential records.');
    return;
  }

  console.log('Coverage findings:');
  for (const finding of findings) {
    console.log(`- [${finding.severity}] ${finding.message}`);
  }
}

async function main() {
  const rows = postgres.isDatabaseConfigured()
    ? await summarizePostgresRecords()
    : summarizeJsonRecords();
  const findings = buildFindings(rows);
  printRows(rows, findings);

  if (process.env.HAZARD_COVERAGE_OUTPUT) {
    fs.writeFileSync(process.env.HAZARD_COVERAGE_OUTPUT, JSON.stringify({
      generatedAt: new Date().toISOString(),
      rows,
      findings
    }, null, 2));
    console.log(`Wrote coverage report to ${process.env.HAZARD_COVERAGE_OUTPUT}`);
  }

  if (findings.some((finding) => finding.severity === 'critical')) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[coverage:audit] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
