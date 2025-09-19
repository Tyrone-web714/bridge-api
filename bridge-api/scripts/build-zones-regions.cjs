#!/usr/bin/env node
/**
 * Build real-world "no-truck" and "residential" polygons for:
 *  - Texas, Oklahoma, New Mexico, Arkansas (major metros/regions)
 * Sources: OpenStreetMap via Overpass API
 *
 * Output:
 *   data/no_truck_zones.json
 *   data/residential_zones.json
 *
 * Usage:
 *   node scripts/build-zones-regions.cjs
 *
 * Notes:
 * - We tile by metro/region bboxes to keep Overpass queries fast/reliable.
 * - "No-truck" is approximated from OSM tags: hgv/goods/truck/access restrictions.
 * - Residential polygons from landuse=residential.
 * - You can add/remove tiles in TILES below as needed.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT_NO_TRUCK = path.join(__dirname, '..', 'data', 'no_truck_zones.json');
const OUT_RES      = path.join(__dirname, '..', 'data', 'residential_zones.json');

// ----------------- Regions (approximate bboxes) -----------------
// Format: [SW_LAT, SW_LNG, NE_LAT, NE_LNG]
// Keep these moderate in size to avoid Overpass timeouts.
const TILES = {
  TX: [
    { id: 'houston',      bbox: [29.40, -95.90, 30.20, -94.90] },
    { id: 'dfw',          bbox: [32.40, -97.70, 33.30, -96.30] },
    { id: 'austin',       bbox: [30.05, -98.10, 30.60, -97.20] },
    { id: 'san_antonio',  bbox: [29.20, -98.90, 29.75, -98.20] },
    { id: 'el_paso',      bbox: [31.55, -106.70, 31.95, -106.10] },
    { id: 'rio_grande',   bbox: [25.75, -98.00, 26.70, -97.00] } // McAllen/Harlingen/Brownsville
  ],
  OK: [
    { id: 'okc',   bbox: [35.20, -97.80, 35.75, -97.20] },
    { id: 'tulsa', bbox: [36.00, -96.20, 36.30, -95.60] }
  ],
  NM: [
    { id: 'abq',         bbox: [35.00, -106.80, 35.25, -106.40] },
    { id: 'santa_fe',    bbox: [35.55, -106.10, 35.80, -105.80] },
    { id: 'las_cruces',  bbox: [32.15, -106.95, 32.45, -106.55] }
  ],
  AR: [
    { id: 'little_rock', bbox: [34.60, -92.55, 34.85, -92.10] },
    { id: 'nwa',         bbox: [36.12, -94.42, 36.50, -93.85] }, // Fayetteville/Springdale/Rogers/Bentonville
    { id: 'fort_smith',  bbox: [35.25, -94.50, 35.50, -94.15] }
  ]
};

// ----------------- Overpass helpers -----------------
const OVERPASS = 'https://overpass-api.de/api/interpreter';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpPostJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : new URLSearchParams(body).toString();
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent': 'bridge-api-zones/1.0'
      }
    }, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(chunks);
          resolve(json);
        } catch (e) {
          reject(new Error(`Overpass response parse error: ${e.message}\n${chunks.slice(0,500)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Queries:
// - No-truck approximation using hgv/goods/truck/access restrictions
function overpassQueryNoTruck(b) {
  // b = [S, W, N, E]
  const bbox = `${b[0]},${b[1]},${b[2]},${b[3]}`;
  return `
[out:json][timeout:90];
(
  way["hgv"="no"](${bbox});
  way["goods"="no"](${bbox});
  way["truck"="no"](${bbox});
  way["access"="no"]["motor_vehicle"!="yes"](${bbox});
  way["hgv:conditional"]["hgv:conditional"~"no"](${bbox});
);
out tags geom;`;
}

// - Residential polygons via landuse=residential
function overpassQueryResidential(b) {
  const bbox = `${b[0]},${b[1]},${b[2]},${b[3]}`;
  return `
[out:json][timeout:90];
(
  way["landuse"="residential"](${bbox});
  relation["landuse"="residential"](${bbox});
);
out tags geom;`;
}

// Convert Overpass JSON elements with geometry[] into our polygon records
function overpassToPolygons(json, { idPrefix }) {
  const out = [];
  const els = (json && json.elements) ? json.elements : [];
  for (const el of els) {
    if (!el.geometry) continue;
    const ring = el.geometry.map(pt => ({ lat: pt.lat, lng: pt.lon }));
    if (ring.length < 3) continue;
    const first = ring[0], last = ring[ring.length - 1];
    const closed = Math.abs(first.lat - last.lat) < 1e-6 && Math.abs(first.lng - last.lng) < 1e-6;
    if (!closed) continue; // only keep closed ways/relations as polygons
    const name = (el.tags && (el.tags.name || el.tags['name:en'])) || `${idPrefix}-${el.id}`;
    out.push({ id: `${idPrefix}-${el.id}`, name, polygon: ring });
  }
  return out;
}

function uniqPolys(polys) {
  const seen = new Set();
  const out = [];
  for (const p of polys) {
    const key = JSON.stringify([p.name, (p.polygon && p.polygon[0]) || null, (p.polygon && p.polygon[1]) || null]);
    if (!seen.has(key)) { seen.add(key); out.push(p); }
  }
  return out;
}

// ----------------- main -----------------
(async () => {
  try {
    const allNoTruck = [];
    const allRes = [];

    const regions = [...TILES.TX, ...TILES.OK, ...TILES.NM, ...TILES.AR];

    for (const t of regions) {
      console.log(`\n=== Processing ${t.id} (${t.bbox.join(', ')}) ===`);

      // No-truck
      console.log('Querying OSM no-truck restrictions…');
      const nt = await httpPostJson(OVERPASS, { data: overpassQueryNoTruck(t.bbox) });
      const ntPolys = overpassToPolygons(nt, { idPrefix: `nt-${t.id}` });
      console.log(` → ${ntPolys.length} no-truck polygons`);

      // Be kind to Overpass
      await sleep(1500);

      // Residential
      console.log('Querying OSM residential landuse…');
      const rs = await httpPostJson(OVERPASS, { data: overpassQueryResidential(t.bbox) });
      const rsPolys = overpassToPolygons(rs, { idPrefix: `res-${t.id}` });
      console.log(` → ${rsPolys.length} residential polygons`);

      allNoTruck.push(...ntPolys);
      allRes.push(...rsPolys);

      // Small pause between tiles
      await sleep(1500);
    }

    const uniqNoTruck = uniqPolys(allNoTruck);
    const uniqRes     = uniqPolys(allRes);

    fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });
    fs.writeFileSync(OUT_NO_TRUCK, JSON.stringify(uniqNoTruck, null, 2));
    fs.writeFileSync(OUT_RES, JSON.stringify(uniqRes, null, 2));

    console.log(`\n✓ Wrote ${OUT_NO_TRUCK} (${uniqNoTruck.length} polygons)`);
    console.log(`✓ Wrote ${OUT_RES} (${uniqRes.length} polygons)`);
    process.exit(0);
  } catch (err) {
    console.error('build-zones-regions error:', err.message);
    process.exit(1);
  }
})();
