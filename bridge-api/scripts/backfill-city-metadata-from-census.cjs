require('dotenv').config();

const postgres = require('../db/postgres');

const OVERWRITE = String(process.env.CITY_BACKFILL_OVERWRITE || '').toLowerCase() === 'true';
const TIGER_YEAR = String(process.env.CENSUS_TIGER_YEAR || '2025').trim();
const SERVICE_STATES = ['TX', 'OK', 'NM', 'AR'];
const STATE_NAME_SQL = `CASE p.state_code
  WHEN 'TX' THEN 'Texas'
  WHEN 'OK' THEN 'Oklahoma'
  WHEN 'NM' THEN 'New Mexico'
  WHEN 'AR' THEN 'Arkansas'
  ELSE p.state_code
END`;
const CITY_WRITE_CONDITION = OVERWRITE
  ? 'true'
  : "(target.location_city IS NULL OR btrim(target.location_city) = '')";
const ADDRESS_WRITE_CONDITION = OVERWRITE
  ? 'true'
  : "(target.location_address IS NULL OR btrim(target.location_address) = '')";
const DESCRIPTION_WRITE_CONDITION = OVERWRITE
  ? 'true'
  : "(target.location_description IS NULL OR btrim(target.location_description) = '')";

async function assertReady() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required before backfilling city metadata.');
  }

  await postgres.ensureSchema();
  if (!(await postgres.isPostgisEnabled())) {
    throw new Error('PostGIS is not ready. Run npm.cmd run db:postgis:init first.');
  }

  const tableResult = await postgres.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'census_places'
    ) AS exists
  `);
  if (!tableResult.rows[0]?.exists) {
    throw new Error('census_places table does not exist. Run npm.cmd run census:places:sync first.');
  }
}

async function backfillLowBridges() {
  const result = await postgres.query(`
    WITH matches AS (
      SELECT DISTINCT ON (target.id)
        target.id,
        p.geoid,
        p.place_name,
        p.place_label,
        p.state_code,
        ${STATE_NAME_SQL} AS state_name
      FROM low_clearance_bridges target
      JOIN census_places p
        ON p.tiger_year = $1
       AND (
         p.state_code = target.state_code
         OR target.state_code IS NULL
         OR btrim(target.state_code) = ''
       )
       AND target.geom IS NOT NULL
       AND p.geom && target.geom
       AND ST_Covers(p.geom, target.geom)
      WHERE target.active = true
        AND (
          target.state_code = ANY($3::text[])
          OR target.state_code IS NULL
          OR btrim(target.state_code) = ''
        )
        AND target.verification_status NOT IN ('inactive', 'incorrect')
        AND (
          ${CITY_WRITE_CONDITION}
          OR target.state_code IS NULL
          OR btrim(target.state_code) = ''
          OR ${DESCRIPTION_WRITE_CONDITION}
        )
      ORDER BY target.id, p.geoid
    )
    UPDATE low_clearance_bridges target
    SET
      location_city = CASE WHEN ${CITY_WRITE_CONDITION} THEN matches.place_name ELSE target.location_city END,
      location_state = CASE
        WHEN target.location_state IS NULL OR btrim(target.location_state) = '' OR $2 = true THEN matches.state_name
        ELSE target.location_state
      END,
      state_code = CASE
        WHEN target.state_code IS NULL OR btrim(target.state_code) = '' OR $2 = true THEN matches.state_code
        ELSE target.state_code
      END,
      location_description = CASE
        WHEN ${DESCRIPTION_WRITE_CONDITION} THEN COALESCE(matches.place_label, matches.place_name)
        ELSE target.location_description
      END,
      raw = COALESCE(target.raw, '{}'::jsonb) || jsonb_build_object(
        'city_metadata_source', 'census_tiger_place',
        'city_metadata_year', $1,
        'city_metadata_updated_at', NOW(),
        'census_place_geoid', matches.geoid
      )
    FROM matches
    WHERE target.id = matches.id
    RETURNING target.id
  `, [TIGER_YEAR, OVERWRITE, SERVICE_STATES]);
  return result.rowCount;
}

async function backfillZones(zoneType) {
  const result = await postgres.query(`
    WITH zone_points AS (
      SELECT
        target.*,
        COALESCE(
          target.marker_geom,
          CASE
            WHEN target.route_geom IS NOT NULL THEN ST_PointOnSurface(target.route_geom)
            ELSE NULL
          END
        ) AS match_geom
      FROM truck_restricted_zones target
      WHERE target.zone_type = $2
        AND target.active = true
        AND (
          target.state_code = ANY($4::text[])
          OR target.state_code IS NULL
          OR btrim(target.state_code) = ''
        )
        AND target.verification_status NOT IN ('inactive', 'incorrect')
    ),
    matches AS (
      SELECT DISTINCT ON (target.id)
        target.id,
        p.geoid,
        p.place_name,
        p.place_label,
        p.state_code,
        ${STATE_NAME_SQL} AS state_name
      FROM zone_points target
      JOIN census_places p
        ON p.tiger_year = $1
       AND (
         p.state_code = target.state_code
         OR target.state_code IS NULL
         OR btrim(target.state_code) = ''
       )
       AND target.match_geom IS NOT NULL
       AND p.geom && target.match_geom
       AND ST_Covers(p.geom, target.match_geom)
      WHERE (
          ${CITY_WRITE_CONDITION}
          OR target.state_code IS NULL
          OR btrim(target.state_code) = ''
          OR ${DESCRIPTION_WRITE_CONDITION}
        )
      ORDER BY target.id, p.geoid
    )
    UPDATE truck_restricted_zones target
    SET
      location_city = CASE WHEN ${CITY_WRITE_CONDITION} THEN matches.place_name ELSE target.location_city END,
      location_state = CASE
        WHEN target.location_state IS NULL OR btrim(target.location_state) = '' OR $3 = true THEN matches.state_name
        ELSE target.location_state
      END,
      state_code = CASE
        WHEN target.state_code IS NULL OR btrim(target.state_code) = '' OR $3 = true THEN matches.state_code
        ELSE target.state_code
      END,
      location_description = CASE
        WHEN ${DESCRIPTION_WRITE_CONDITION} THEN COALESCE(matches.place_label, matches.place_name)
        ELSE target.location_description
      END,
      raw = COALESCE(target.raw, '{}'::jsonb) || jsonb_build_object(
        'city_metadata_source', 'census_tiger_place',
        'city_metadata_year', $1,
        'city_metadata_updated_at', NOW(),
        'census_place_geoid', matches.geoid
      )
    FROM matches
    WHERE target.id = matches.id
    RETURNING target.id
  `, [TIGER_YEAR, zoneType, OVERWRITE, SERVICE_STATES]);
  return result.rowCount;
}

async function printCoverage() {
  const result = await postgres.query(`
    SELECT 'low_bridge' AS category, state_code, count(*)::int AS total,
      count(*) FILTER (WHERE location_city IS NOT NULL AND btrim(location_city) <> '')::int AS with_city
    FROM low_clearance_bridges
    WHERE active = true AND verification_status NOT IN ('inactive', 'incorrect')
    GROUP BY state_code
    UNION ALL
    SELECT zone_type AS category, state_code, count(*)::int AS total,
      count(*) FILTER (WHERE location_city IS NOT NULL AND btrim(location_city) <> '')::int AS with_city
    FROM truck_restricted_zones
    WHERE zone_type IN ('no_truck', 'residential')
      AND active = true
      AND verification_status NOT IN ('inactive', 'incorrect')
    GROUP BY zone_type, state_code
    ORDER BY category, state_code
  `);
  console.table(result.rows);
}

async function main() {
  await assertReady();
  const bridgeCount = await backfillLowBridges();
  const noTruckCount = await backfillZones('no_truck');
  const residentialCount = await backfillZones('residential');

  console.log(`[city:backfill] low bridges updated: ${bridgeCount}`);
  console.log(`[city:backfill] no-truck zones updated: ${noTruckCount}`);
  console.log(`[city:backfill] residential zones updated: ${residentialCount}`);
  console.log(`[city:backfill] overwrite mode: ${OVERWRITE ? 'on' : 'off'}`);
  await printCoverage();
}

main()
  .catch((error) => {
    console.error('[city:backfill] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
