const fs = require('fs');
const path = require('path');
require('dotenv').config();

const postgres = require('../db/postgres');

const DEFAULT_OUTPUT = path.join(__dirname, '..', 'data', 'low_bridge_verification_candidates.csv');
const SERVICE_STATES = ['TX', 'OK', 'NM', 'AR'];

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function stateCaseSql() {
  return `CASE
    WHEN upper(state_code) IN ('TX', 'OK', 'NM', 'AR') THEN upper(state_code)
    WHEN latitude BETWEEN 25.8 AND 36.6 AND longitude BETWEEN -106.7 AND -93.5 THEN 'TX'
    WHEN latitude BETWEEN 33.6 AND 37.2 AND longitude BETWEEN -103.2 AND -94.3 THEN 'OK'
    WHEN latitude BETWEEN 31.2 AND 37.1 AND longitude BETWEEN -109.1 AND -103.0 THEN 'NM'
    WHEN latitude BETWEEN 33.0 AND 36.6 AND longitude BETWEEN -94.7 AND -89.6 THEN 'AR'
    ELSE 'UNKNOWN'
  END`;
}

function rowPrioritySql() {
  return `(
    CASE WHEN clearance_ft IS NULL THEN 50 ELSE 0 END +
    CASE WHEN location_address IS NULL OR btrim(location_address) = '' THEN 25 ELSE 0 END +
    CASE WHEN location_city IS NULL OR btrim(location_city) = '' THEN 15 ELSE 0 END +
    CASE WHEN verification_status = 'unverified' THEN 10 ELSE 0 END
  )`;
}

async function loadCandidates(limit) {
  await postgres.ensureSchema();
  const result = await postgres.query(`
    WITH normalized AS (
      SELECT
        id,
        COALESCE(raw->>'name', raw->>'road', raw->>'street', raw->>'description') AS name,
        latitude,
        longitude,
        clearance_ft,
        location_address,
        location_description,
        location_city,
        location_state,
        ${stateCaseSql()} AS inferred_state_code,
        verification_status,
        verification_notes,
        active,
        ${rowPrioritySql()} AS priority_score
      FROM low_clearance_bridges
      WHERE active = true
        AND verification_status NOT IN ('verified', 'inactive', 'incorrect')
    )
    SELECT *
    FROM normalized
    WHERE inferred_state_code = ANY($1::text[])
    ORDER BY priority_score DESC, inferred_state_code, location_city NULLS LAST, id
    LIMIT $2
  `, [SERVICE_STATES, limit]);
  return result.rows;
}

function buildCsv(rows) {
  const header = [
    'priority_score',
    'state',
    'city',
    'address_or_landmark',
    'bridge_name',
    'clearance_ft',
    'latitude',
    'longitude',
    'verification_status',
    'verification_notes',
    'bridge_id'
  ];
  const lines = [header];
  for (const row of rows) {
    lines.push([
      row.priority_score,
      row.inferred_state_code,
      row.location_city || '',
      row.location_address || row.location_description || '',
      row.name || '',
      row.clearance_ft ?? '',
      row.latitude ?? '',
      row.longitude ?? '',
      row.verification_status || '',
      row.verification_notes || '',
      row.id
    ]);
  }
  return lines.map((line) => line.map(csvEscape).join(',')).join('\r\n');
}

async function main() {
  if (!postgres.isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is required because bridge verification candidates come from PostgreSQL.');
  }

  const limit = Math.min(Math.max(Number(process.env.LOW_BRIDGE_VERIFY_LIMIT) || 500, 1), 10000);
  const outputPath = process.env.LOW_BRIDGE_VERIFY_OUTPUT || DEFAULT_OUTPUT;
  const rows = await loadCandidates(limit);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buildCsv(rows));

  console.log(`Exported ${rows.length} low-bridge verification candidate(s).`);
  console.log(`Output: ${outputPath}`);
  console.log('Priority favors missing clearance, missing address/city, and unverified records.');
}

main()
  .catch((error) => {
    console.error('[bridges:verification:export] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
