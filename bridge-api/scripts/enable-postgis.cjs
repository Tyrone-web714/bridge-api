const fs = require('fs');
const path = require('path');
require('dotenv').config();

const postgres = require('../db/postgres');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJsonArray(filename) {
  const fullPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fullPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  return Array.isArray(parsed) ? parsed : [];
}

function pointGeoJson(point) {
  const lat = Number(point?.lat ?? point?.latitude);
  const lng = Number(point?.lng ?? point?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { type: 'Point', coordinates: [lng, lat] };
}

function lineGeoJson(points) {
  const coordinates = (Array.isArray(points) ? points : [])
    .map((point) => {
      const lat = Number(point?.lat ?? point?.latitude);
      const lng = Number(point?.lng ?? point?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
    })
    .filter(Boolean);

  return coordinates.length >= 2 ? { type: 'LineString', coordinates } : null;
}

function polygonGeoJson(points) {
  const coordinates = (Array.isArray(points) ? points : [])
    .map((point) => {
      const lat = Number(point?.lat ?? point?.latitude);
      const lng = Number(point?.lng ?? point?.longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
    })
    .filter(Boolean);

  if (coordinates.length < 3) return null;

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push(first);
  }

  return { type: 'Polygon', coordinates: [coordinates] };
}

async function addPostgisSchema() {
  await postgres.rawQuery('CREATE EXTENSION IF NOT EXISTS postgis');
  await postgres.rawQuery(`
    ALTER TABLE low_clearance_bridges
      ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

    ALTER TABLE truck_restricted_zones
      ADD COLUMN IF NOT EXISTS marker_geom geometry(Point, 4326),
      ADD COLUMN IF NOT EXISTS route_geom geometry(Geometry, 4326);

    CREATE INDEX IF NOT EXISTS low_clearance_bridges_geom_gix
      ON low_clearance_bridges USING GIST (geom);

    CREATE INDEX IF NOT EXISTS truck_restricted_zones_marker_geom_gix
      ON truck_restricted_zones USING GIST (marker_geom);

    CREATE INDEX IF NOT EXISTS truck_restricted_zones_route_geom_gix
      ON truck_restricted_zones USING GIST (route_geom);
  `);
}

async function backfillBridges() {
  const bridges = readJsonArray('low_clearance_bridges.json');
  let updated = 0;

  for (const bridge of bridges) {
    const id = String(bridge.id || `bridge-${bridge.latitude}-${bridge.longitude}`);
    const lat = Number(bridge.latitude);
    const lng = Number(bridge.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    await postgres.rawQuery(`
      UPDATE low_clearance_bridges
      SET geom = ST_SetSRID(ST_MakePoint($2, $3), 4326)
      WHERE id = $1
    `, [id, lng, lat]);

    updated += 1;
    if (updated % 1000 === 0) {
      console.log(`[postgis:init] bridge geometries ${updated}/${bridges.length}`);
    }
  }

  console.log(`[postgis:init] bridge geometries ${updated}/${bridges.length}`);
}

async function backfillZones(filename, zoneType) {
  const zones = readJsonArray(filename);
  let updated = 0;

  for (const zone of zones) {
    const id = String(zone.id || `${zoneType}-${zone.name || updated}`);
    const markerSource = Array.isArray(zone.geometry)
      ? zone.geometry[0]
      : Array.isArray(zone.polygon)
        ? zone.polygon[0]
        : { lat: zone.latitude, lng: zone.longitude };
    const marker = pointGeoJson({
      lat: zone.latitude ?? markerSource?.lat,
      lng: zone.longitude ?? markerSource?.lng
    });
    const route = polygonGeoJson(zone.polygon) || lineGeoJson(zone.geometry) || marker;

    await postgres.rawQuery(`
      UPDATE truck_restricted_zones
      SET
        marker_geom = CASE WHEN $2::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($2::text), 4326) END,
        route_geom = CASE WHEN $3::text IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($3::text), 4326) END
      WHERE id = $1
    `, [
      id,
      marker ? JSON.stringify(marker) : null,
      route ? JSON.stringify(route) : null
    ]);

    updated += 1;
    if (updated % 5000 === 0) {
      console.log(`[postgis:init] ${zoneType} geometries ${updated}/${zones.length}`);
    }
  }

  console.log(`[postgis:init] ${zoneType} geometries ${updated}/${zones.length}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required before enabling PostGIS.');
  }

  console.log('[postgis:init] ensuring base database schema');
  await postgres.ensureSchema();
  console.log('[postgis:init] enabling extension and spatial columns');
  await addPostgisSchema();
  console.log('[postgis:init] backfilling spatial geometries');
  await backfillBridges();
  await backfillZones('no_truck_zones.json', 'no_truck');
  await backfillZones('residential_zones.json', 'residential');
  console.log('[postgis:init] complete');
}

main()
  .catch((error) => {
    console.error('[postgis:init] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
