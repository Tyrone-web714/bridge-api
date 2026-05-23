const dotenv = require('dotenv');
const postgres = require('../db/postgres');

dotenv.config();

const CATEGORY_TABLES = {
  low_bridge: { table: 'low_clearance_bridges', zoneType: null },
  no_truck: { table: 'truck_restricted_zones', zoneType: 'no_truck' },
  residential: { table: 'truck_restricted_zones', zoneType: 'residential' }
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseAddressComponent(components, type, useShortName = false) {
  const match = components.find((component) => component.types.includes(type));
  if (!match) return null;
  return useShortName ? match.short_name : match.long_name;
}

function parseGeocodeResult(result) {
  const components = Array.isArray(result?.address_components) ? result.address_components : [];
  const city =
    parseAddressComponent(components, 'locality') ||
    parseAddressComponent(components, 'postal_town') ||
    parseAddressComponent(components, 'sublocality') ||
    parseAddressComponent(components, 'administrative_area_level_3') ||
    parseAddressComponent(components, 'administrative_area_level_2');
  const state = parseAddressComponent(components, 'administrative_area_level_1');
  const stateCode = parseAddressComponent(components, 'administrative_area_level_1', true);

  return {
    address: result?.formatted_address || null,
    city,
    state,
    stateCode
  };
}

async function reverseGeocode(latitude, longitude) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error('GOOGLE_MAPS_API_KEY is required for reverse geocoding.');

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${latitude},${longitude}`);
  url.searchParams.set('key', key);

  const response = await fetch(url);
  const data = await response.json();
  if (data.status !== 'OK' || !Array.isArray(data.results) || !data.results.length) {
    return null;
  }
  return parseGeocodeResult(data.results[0]);
}

async function reserveJobs(limit) {
  const result = await postgres.query(`
    WITH selected AS (
      SELECT id
      FROM static_hazard_location_backfill_queue
      WHERE status IN ('queued', 'failed')
        AND attempts < 5
      ORDER BY priority, queued_at
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE static_hazard_location_backfill_queue q
    SET status = 'processing',
      processing_started_at = NOW(),
      attempts = attempts + 1,
      last_error = NULL
    FROM selected
    WHERE q.id = selected.id
    RETURNING q.*
  `, [limit]);
  return result.rows;
}

async function getHazardForJob(job) {
  const config = CATEGORY_TABLES[job.hazard_category];
  if (!config) return null;
  const values = [job.hazard_id];
  let zoneWhere = '';
  if (config.zoneType) {
    values.push(config.zoneType);
    zoneWhere = `AND zone_type = $${values.length}`;
  }
  const result = await postgres.query(`
    SELECT id, latitude, longitude
    FROM ${config.table}
    WHERE id = $1
      ${zoneWhere}
  `, values);
  return result.rows[0] ? { ...result.rows[0], table: config.table } : null;
}

async function updateHazardLocation(hazard, location) {
  await postgres.query(`
    UPDATE ${hazard.table}
    SET
      location_address = COALESCE($2, location_address),
      location_city = COALESCE($3, location_city),
      location_state = COALESCE($4, location_state),
      state_code = COALESCE($5, state_code)
    WHERE id = $1
  `, [
    hazard.id,
    location.address,
    location.city,
    location.state,
    location.stateCode
  ]);
}

async function completeJob(job, location) {
  await postgres.query(`
    UPDATE static_hazard_location_backfill_queue
    SET status = 'done',
      processed_at = NOW(),
      result = $2::jsonb
    WHERE id = $1
  `, [job.id, JSON.stringify(location || {})]);
}

async function failJob(job, error) {
  await postgres.query(`
    UPDATE static_hazard_location_backfill_queue
    SET status = 'failed',
      last_error = $2,
      processed_at = NOW()
    WHERE id = $1
  `, [job.id, String(error?.message || error).slice(0, 1000)]);
}

async function main() {
  const limit = Math.min(Math.max(Number(process.env.LOCATION_BACKFILL_PROCESS_LIMIT) || 25, 1), 250);
  const sleepMs = Math.min(Math.max(Number(process.env.LOCATION_BACKFILL_SLEEP_MS) || 120, 0), 5000);

  await postgres.ensureSchema();
  const jobs = await reserveJobs(limit);
  console.log(`[locations:process] reserved ${jobs.length} job(s)`);

  let completed = 0;
  for (const [index, job] of jobs.entries()) {
    try {
      const hazard = await getHazardForJob(job);
      if (!hazard || !Number.isFinite(Number(hazard.latitude)) || !Number.isFinite(Number(hazard.longitude))) {
        await failJob(job, new Error('hazard not found or missing coordinates'));
        continue;
      }

      const location = await reverseGeocode(hazard.latitude, hazard.longitude);
      if (!location) {
        await failJob(job, new Error('no geocode result'));
        continue;
      }

      await updateHazardLocation(hazard, location);
      await completeJob(job, location);
      completed += 1;
      console.log(`[${index + 1}/${jobs.length}] ${job.hazard_category} ${job.hazard_id} -> ${location.city || 'unknown'}, ${location.stateCode || location.state || 'unknown'}`);
      if (sleepMs) await sleep(sleepMs);
    } catch (error) {
      await failJob(job, error);
      console.log(`[${index + 1}/${jobs.length}] ${job.hazard_category} ${job.hazard_id} failed: ${error.message}`);
    }
  }

  console.log(`[locations:process] completed ${completed}/${jobs.length}`);
}

main()
  .catch((error) => {
    console.error('[locations:process] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
