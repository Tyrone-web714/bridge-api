// routes/bridges.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Load dataset (fail fast if missing)
const DATA_PATH = path.join(__dirname, '..', 'data', 'low_clearance_bridges.json');
let BRIDGES = [];
try {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  BRIDGES = JSON.parse(raw);
  console.log(`[bridges] Loaded ${BRIDGES.length} low-clearance points from ${DATA_PATH}`);
} catch (e) {
  console.error('[bridges] Failed to load dataset:', e.message);
  BRIDGES = [];
}

// helpers
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// GET /api/bridges/stats  -> { count }
router.get('/stats', (req, res) => {
  res.json({ count: Array.isArray(BRIDGES) ? BRIDGES.length : 0, path: DATA_PATH });
});

// GET /api/bridges/sample?limit=5
router.get('/sample', (req, res) => {
  const n = Math.max(1, Math.min(50, toNum(req.query.limit) ?? 5));
  return res.json(BRIDGES.slice(0, n));
});

// GET /api/bridges?swLat=&swLng=&neLat=&neLng=&limit=
router.get('/', (req, res) => {
  let { swLat, swLng, neLat, neLng } = req.query;

  const SWLAT = toNum(swLat);
  const SWLNG = toNum(swLng);
  const NELAT = toNum(neLat);
  const NELNG = toNum(neLng);

  // If any param missing/invalid: return a small sample so you see something
  if ([SWLAT, SWLNG, NELAT, NELNG].some(v => v === null)) {
    const limit = Math.max(1, Math.min(500, toNum(req.query.limit) ?? 100));
    return res.json(BRIDGES.slice(0, limit));
  }

  // Normalize corners (handles swapped inputs)
  const minLat = Math.min(SWLAT, NELAT);
  const maxLat = Math.max(SWLAT, NELAT);
  const minLng = Math.min(SWLNG, NELNG);
  const maxLng = Math.max(SWLNG, NELNG);

  const hits = [];
  for (const b of BRIDGES) {
    if (b.latitude >= minLat && b.latitude <= maxLat &&
        b.longitude >= minLng && b.longitude <= maxLng) {
      hits.push(b);
      if (hits.length >= 50000) break; // safety cap
    }
  }

  const limit = Math.max(1, Math.min(50000, toNum(req.query.limit) ?? hits.length));
  res.json(hits.slice(0, limit));
});

module.exports = router;


