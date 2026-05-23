#!/usr/bin/env node
/**
 * Build truck-restricted roads and residential polygons for the four-state
 * Coca-Cola Southwest Beverages service area:
 *   Texas, Oklahoma, New Mexico, Arkansas
 *
 * Source: OpenStreetMap via Overpass API.
 *
 * Outputs:
 *   data/no_truck_zones.json       restricted road geometry + any closed no-truck polygons
 *   data/residential_zones.json    landuse=residential polygons
 *
 * Important:
 * - Public OSM data is a strong baseline, not a legal/compliance-certified
 *   substitute for state DOT/local ordinance datasets.
 * - Many truck restrictions are mapped as road ways, not polygons. This script
 *   preserves restricted road lines and the backend scorer checks route
 *   proximity to those lines.
 *
 * Usage:
 *   npm run build:zones:sw
 *
 * Useful environment controls:
 *   ZONE_TILE_LIMIT=10              run only first 10 tiles for testing
 *   ZONE_STATE_FILTER=TX,OK         run selected states only
 *   ZONE_GRID_STEP_DEG=1.0          tile size in degrees
 *   ZONE_SLEEP_MS=1200              pause between Overpass calls
 *   ZONE_RETRIES=3                  retry each Overpass query before skipping
 *   ZONE_RETRY_SLEEP_MS=5000        pause before retry attempts
 *   OVERPASS_URLS=url1;url2         semicolon-separated Overpass endpoints
 *   ZONE_OUTPUT_DIR=tmp/zones-test   write test output somewhere else
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = process.env.ZONE_OUTPUT_DIR || path.join(__dirname, '..', 'data');
const OUT_NO_TRUCK = path.join(OUTPUT_DIR, 'no_truck_zones.json');
const OUT_RES = path.join(OUTPUT_DIR, 'residential_zones.json');
const OUT_FAILURES = path.join(OUTPUT_DIR, 'zones_import_failures.json');
const OVERPASS_ENDPOINTS = String(
  process.env.OVERPASS_URLS ||
  process.env.OVERPASS_URL ||
  'https://overpass-api.de/api/interpreter;https://overpass.kumi.systems/api/interpreter'
)
  .split(/[;,]/)
  .map((value) => value.trim())
  .filter(Boolean);
const GRID_STEP_DEG = Number(process.env.ZONE_GRID_STEP_DEG || 1.0);
const SLEEP_MS = Number(process.env.ZONE_SLEEP_MS || 1200);
const OVERPASS_RETRIES = Number(process.env.ZONE_RETRIES || 3);
const RETRY_SLEEP_MS = Number(process.env.ZONE_RETRY_SLEEP_MS || 5000);
const TILE_LIMIT = Number(process.env.ZONE_TILE_LIMIT || 0);
const STATE_FILTER = new Set(
  String(process.env.ZONE_STATE_FILTER || '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
);

const STATES = {
  TX: { name: 'Texas', bbox: [25.80, -106.70, 36.60, -93.50] },
  OK: { name: 'Oklahoma', bbox: [33.60, -103.20, 37.20, -94.30] },
  NM: { name: 'New Mexico', bbox: [31.20, -109.10, 37.10, -103.00] },
  AR: { name: 'Arkansas', bbox: [33.00, -94.70, 36.60, -89.60] }
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorToString(error) {
  if (!error) return 'Unknown error';
  if (error.stack) return error.stack;
  if (error.message) return error.message;

  try {
    return JSON.stringify(error);
  } catch (_) {
    return String(error);
  }
}

function makeTiles() {
  const tiles = [];

  for (const [stateCode, state] of Object.entries(STATES)) {
    if (STATE_FILTER.size && !STATE_FILTER.has(stateCode)) continue;

    const [south, west, north, east] = state.bbox;
    let row = 0;
    for (let s = south; s < north; s += GRID_STEP_DEG) {
      let col = 0;
      for (let w = west; w < east; w += GRID_STEP_DEG) {
        tiles.push({
          id: `${stateCode.toLowerCase()}_${row}_${col}`,
          stateCode,
          stateName: state.name,
          bbox: [
            Number(s.toFixed(6)),
            Number(w.toFixed(6)),
            Number(Math.min(s + GRID_STEP_DEG, north).toFixed(6)),
            Number(Math.min(w + GRID_STEP_DEG, east).toFixed(6))
          ]
        });
        col += 1;
      }
      row += 1;
    }
  }

  return TILE_LIMIT > 0 ? tiles.slice(0, TILE_LIMIT) : tiles;
}

function httpPostJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : new URLSearchParams(body).toString();
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'truck-safe-routing-zone-import/1.0'
      }
    }, (res) => {
      let chunks = '';
      res.on('data', (chunk) => { chunks += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Overpass HTTP ${res.statusCode}: ${chunks.slice(0, 500)}`));
          return;
        }

        try {
          resolve(JSON.parse(chunks));
        } catch (error) {
          reject(new Error(`Overpass JSON parse error: ${error.message}\n${chunks.slice(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function queryOverpass(query, label, tile) {
  const maxAttempts = Math.max(1, OVERPASS_RETRIES);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        return await httpPostJson(endpoint, { data: query });
      } catch (error) {
        lastError = error;
        const shortError = errorToString(error).split('\n')[0];
        console.warn(`  ${label} failed on attempt ${attempt}/${maxAttempts} via ${endpoint}: ${shortError}`);
      }
    }

    if (attempt < maxAttempts) {
      console.log(`  Waiting ${RETRY_SLEEP_MS}ms before retrying ${label}...`);
      await sleep(RETRY_SLEEP_MS);
    }
  }

  throw new Error(`${label} failed for ${tile.stateCode} ${tile.id}: ${errorToString(lastError)}`);
}

function bboxToOverpass(bbox) {
  return `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`;
}

function overpassQueryNoTruck(bbox) {
  const box = bboxToOverpass(bbox);

  return `
[out:json][timeout:120];
(
  way["hgv"~"^(no|destination|delivery|private)$"](${box});
  way["goods"~"^(no|destination|delivery|private)$"](${box});
  way["truck"~"^(no|destination|delivery|private)$"](${box});
  way["hgv:conditional"~"(no|destination|delivery|private)",i](${box});
  way["goods:conditional"~"(no|destination|delivery|private)",i](${box});
  way["maxweight"](${box});
  way["maxweightrating:hgv"](${box});
  way["maxlength:hgv"](${box});
  way["hazmat"="no"](${box});
  relation["hgv"~"^(no|destination|delivery|private)$"](${box});
  relation["goods"~"^(no|destination|delivery|private)$"](${box});
);
out tags geom;`;
}

function overpassQueryResidential(bbox) {
  const box = bboxToOverpass(bbox);

  return `
[out:json][timeout:120];
(
  way["landuse"="residential"](${box});
  relation["landuse"="residential"](${box});
);
out tags geom;`;
}

function toGeometry(element) {
  return (element.geometry || [])
    .map((point) => ({ lat: Number(point.lat), lng: Number(point.lon) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function isClosedRing(geometry) {
  if (geometry.length < 4) return false;

  const first = geometry[0];
  const last = geometry[geometry.length - 1];
  return Math.abs(first.lat - last.lat) < 1e-6 && Math.abs(first.lng - last.lng) < 1e-6;
}

function restrictionFromTags(tags = {}) {
  const restrictionKeys = [
    'hgv',
    'goods',
    'truck',
    'hgv:conditional',
    'goods:conditional',
    'maxweight',
    'maxweightrating:hgv',
    'maxlength:hgv',
    'hazmat'
  ];

  const entries = restrictionKeys
    .filter((key) => tags[key] != null)
    .map((key) => `${key}=${tags[key]}`);

  return entries.join('; ') || 'truck restriction';
}

function elementName(element, fallbackPrefix) {
  return (
    element.tags?.name ||
    element.tags?.['name:en'] ||
    element.tags?.ref ||
    `${fallbackPrefix}-${element.type}-${element.id}`
  );
}

function overpassToRestrictedRoads(json, tile) {
  const output = [];

  for (const element of json.elements || []) {
    const geometry = toGeometry(element);
    if (geometry.length < 2) continue;

    const closed = isClosedRing(geometry);
    output.push({
      id: `nt-${element.type}-${element.id}`,
      name: elementName(element, 'truck-restricted'),
      state: tile.stateCode,
      state_name: tile.stateName,
      source: 'openstreetmap-overpass',
      source_updated_at: new Date().toISOString(),
      restriction: restrictionFromTags(element.tags),
      type: closed ? 'restricted_polygon' : 'restricted_road',
      polygon: closed ? geometry : undefined,
      geometry: closed ? undefined : geometry,
      osm: {
        type: element.type,
        id: element.id,
        tags: element.tags || {}
      }
    });
  }

  return output;
}

function overpassToResidentialPolygons(json, tile) {
  const output = [];

  for (const element of json.elements || []) {
    const geometry = toGeometry(element);
    if (!isClosedRing(geometry)) continue;

    output.push({
      id: `res-${element.type}-${element.id}`,
      name: elementName(element, 'residential'),
      state: tile.stateCode,
      state_name: tile.stateName,
      source: 'openstreetmap-overpass',
      source_updated_at: new Date().toISOString(),
      type: 'residential_polygon',
      polygon: geometry,
      osm: {
        type: element.type,
        id: element.id,
        tags: element.tags || {}
      }
    });
  }

  return output;
}

function uniqueById(records) {
  const seen = new Set();
  const output = [];

  for (const record of records) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    output.push(record);
  }

  return output;
}

function backupIfExists(filePath) {
  if (!fs.existsSync(filePath)) return;

  const backupPath = `${filePath}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(filePath, backupPath);
  console.log(`Backup: ${backupPath}`);
}

function writeJsonWithBackup(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  backupIfExists(filePath);
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
  console.log(`Wrote ${filePath} (${records.length} records)`);
}

async function main() {
  const tiles = makeTiles();
  console.log(`Building zones for ${tiles.length} tile(s) using ${OVERPASS_ENDPOINTS.join(', ')}`);
  console.log(`State filter: ${STATE_FILTER.size ? [...STATE_FILTER].join(', ') : 'ALL'}`);
  console.log(`Tile limit: ${TILE_LIMIT > 0 ? TILE_LIMIT : 'none'}`);
  console.log(`Grid step: ${GRID_STEP_DEG}`);
  console.log(`Retries: ${Math.max(1, OVERPASS_RETRIES)}`);

  const allNoTruck = [];
  const allResidential = [];
  const failures = [];

  for (const [index, tile] of tiles.entries()) {
    console.log(`\n[${index + 1}/${tiles.length}] ${tile.stateCode} ${tile.id} ${tile.bbox.join(', ')}`);

    console.log('Query truck restrictions...');
    try {
      const noTruckJson = await queryOverpass(overpassQueryNoTruck(tile.bbox), 'truck restrictions', tile);
      const noTruckRecords = overpassToRestrictedRoads(noTruckJson, tile);
      console.log(`  ${noTruckRecords.length} restricted road/polygon record(s)`);
      allNoTruck.push(...noTruckRecords);
    } catch (error) {
      const failure = {
        state: tile.stateCode,
        tile: tile.id,
        bbox: tile.bbox,
        kind: 'truck_restrictions',
        error: errorToString(error),
        failed_at: new Date().toISOString()
      };
      failures.push(failure);
      console.warn(`  Skipping truck restrictions for ${tile.stateCode} ${tile.id}; recorded in failure report.`);
    }

    await sleep(SLEEP_MS);

    console.log('Query residential polygons...');
    try {
      const residentialJson = await queryOverpass(overpassQueryResidential(tile.bbox), 'residential polygons', tile);
      const residentialRecords = overpassToResidentialPolygons(residentialJson, tile);
      console.log(`  ${residentialRecords.length} residential polygon(s)`);
      allResidential.push(...residentialRecords);
    } catch (error) {
      const failure = {
        state: tile.stateCode,
        tile: tile.id,
        bbox: tile.bbox,
        kind: 'residential_polygons',
        error: errorToString(error),
        failed_at: new Date().toISOString()
      };
      failures.push(failure);
      console.warn(`  Skipping residential polygons for ${tile.stateCode} ${tile.id}; recorded in failure report.`);
    }

    await sleep(SLEEP_MS);
  }

  const noTruck = uniqueById(allNoTruck);
  const residential = uniqueById(allResidential);

  const summarizeByState = (records) => records.reduce((summary, record) => {
    const state = record.state || 'UNKNOWN';
    summary[state] = (summary[state] || 0) + 1;
    return summary;
  }, {});

  writeJsonWithBackup(OUT_NO_TRUCK, noTruck);
  writeJsonWithBackup(OUT_RES, residential);
  if (failures.length > 0) {
    writeJsonWithBackup(OUT_FAILURES, failures);
  } else if (fs.existsSync(OUT_FAILURES)) {
    backupIfExists(OUT_FAILURES);
    fs.unlinkSync(OUT_FAILURES);
    console.log(`Removed stale failure report: ${OUT_FAILURES}`);
  }

  console.log('\nState summary:');
  console.log('Truck restrictions:', summarizeByState(noTruck));
  console.log('Residential polygons:', summarizeByState(residential));
  console.log('Import failures:', failures.length);
  if (failures.length > 0) {
    console.log(`Failure report: ${OUT_FAILURES}`);
  }

  console.log('\nComplete.');
}

main().catch((error) => {
  console.error('build-zones-regions failed:', errorToString(error));
  process.exit(1);
});
