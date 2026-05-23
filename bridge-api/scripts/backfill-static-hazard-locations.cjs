const dotenv = require('dotenv');
const postgres = require('../db/postgres');

dotenv.config();

const SERVICE_AREA_BOUNDS_SQL = `
  (
    (latitude BETWEEN 25.8 AND 36.6 AND longitude BETWEEN -106.7 AND -93.5)
    OR (latitude BETWEEN 33.6 AND 37.1 AND longitude BETWEEN -103.1 AND -94.3)
    OR (latitude BETWEEN 31.2 AND 37.1 AND longitude BETWEEN -109.1 AND -103.0)
    OR (latitude BETWEEN 33.0 AND 36.6 AND longitude BETWEEN -94.7 AND -89.6)
  )
`;

const CATEGORY_CONFIG = {
  low_bridge: {
    table: 'low_clearance_bridges',
    where: 'TRUE',
    nameSql: "raw->>'name'"
  },
  no_truck: {
    table: 'truck_restricted_zones',
    where: "zone_type = 'no_truck'",
    nameSql: 'name'
  },
  residential: {
    table: 'truck_restricted_zones',
    where: "zone_type = 'residential'",
    nameSql: 'name'
  }
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
  if (!key) {
    throw new Error('GOOGLE_MAPS_API_KEY is required for reverse geocoding.');
  }

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

async function getRecordsForCategory(category, limit, scope) {
  const config = CATEGORY_CONFIG[category];
  const scopeWhere = scope === 'all' ? 'TRUE' : SERVICE_AREA_BOUNDS_SQL;
  const result = await postgres.query(`
    SELECT id, latitude, longitude, ${config.nameSql} AS name, location_address, location_city, location_state, state_code
    FROM ${config.table}
    WHERE ${config.where}
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND ${scopeWhere}
      AND (
        location_address IS NULL
        OR location_city IS NULL
        OR location_state IS NULL
        OR state_code IS NULL
      )
    ORDER BY id
    LIMIT $1
  `, [limit]);

  return result.rows.map((row) => ({ ...row, category, table: config.table }));
}

async function updateRecord(record, location) {
  await postgres.query(`
    UPDATE ${record.table}
    SET
      location_address = COALESCE($2, location_address),
      location_city = COALESCE($3, location_city),
      location_state = COALESCE($4, location_state),
      state_code = COALESCE($5, state_code),
      location_description = COALESCE(location_description, $6)
    WHERE id = $1
  `, [
    record.id,
    location.address,
    location.city,
    location.state,
    location.stateCode,
    record.name || null
  ]);
}

async function main() {
  const requestedCategory = String(process.env.LOCATION_BACKFILL_CATEGORY || 'all').trim().toLowerCase();
  const categories = requestedCategory === 'all'
    ? Object.keys(CATEGORY_CONFIG)
    : [requestedCategory];
  const invalidCategory = categories.find((category) => !CATEGORY_CONFIG[category]);
  if (invalidCategory) {
    throw new Error(`Invalid LOCATION_BACKFILL_CATEGORY: ${invalidCategory}`);
  }

  const limit = Math.min(Math.max(Number(process.env.LOCATION_BACKFILL_LIMIT) || 50, 1), 1000);
  const sleepMs = Math.min(Math.max(Number(process.env.LOCATION_BACKFILL_SLEEP_MS) || 120, 0), 5000);
  const scope = String(process.env.LOCATION_BACKFILL_SCOPE || 'service').trim().toLowerCase() === 'all'
    ? 'all'
    : 'service';

  await postgres.ensureSchema();

  let records = [];
  for (const category of categories) {
    const perCategoryLimit = Math.max(1, Math.ceil(limit / categories.length));
    records = records.concat(await getRecordsForCategory(category, perCategoryLimit, scope));
  }
  records = records.slice(0, limit);

  console.log(`[locations] Backfilling ${records.length} record(s). scope=${scope} category=${requestedCategory}`);

  let updated = 0;
  for (const [index, record] of records.entries()) {
    const location = await reverseGeocode(record.latitude, record.longitude);
    if (location) {
      await updateRecord(record, location);
      updated += 1;
      console.log(`[${index + 1}/${records.length}] ${record.category} ${record.id} -> ${location.city || 'unknown'}, ${location.stateCode || location.state || 'unknown'}`);
    } else {
      console.log(`[${index + 1}/${records.length}] ${record.category} ${record.id} -> no geocode result`);
    }
    if (sleepMs) await sleep(sleepMs);
  }

  console.log(`[locations] Updated ${updated}/${records.length} record(s).`);
}

main()
  .catch((error) => {
    console.error('[locations] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
