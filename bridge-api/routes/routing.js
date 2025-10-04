// routes/routing.js
const express = require('express');
const { Client } = require('@googlemaps/google-maps-services-js');
const router = express.Router();

const client = new Client({});

// DATA
const bridges = require('../data/low_clearance_bridges.json');        // [{id, latitude, longitude, clearance_ft, ...}]
let noTruckZones = [];
let residentialZones = [];

// Safe fallbacks if files not present
try { noTruckZones = require('../data/no_truck_zones.json'); } catch {}
try { residentialZones = require('../data/residential_zones.json'); } catch {}

// ------- helpers -------

// Haversine distance in meters
function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Ray-casting point-in-polygon
function pointInPolygon(point, polygon) {
  let x = point.lat, y = point.lng;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Decode Google encoded polyline
function decodePolyline(str) {
  let index = 0, lat = 0, lng = 0, out = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1); lat += dlat;
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1); lng += dlng;
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

// Count hazards for a polyline (array of {lat,lng})
function scoreRoute(points, opts) {
  const {
    truckHeightFt = 13.6,            // Coca-Cola typical box trailers can be near 13'6"
    safetyMarginFt = 0.3,            // ~3.6 inches margin
    minCutoffFt = 13.0,              // never allow below 13 even if truck shorter
    bridgeBufferMeters = 120         // more generous buffer to catch near-path bridges
  } = opts || {};

  // Required clearance is max(truckHeight + margin, regulatory cutoff)
  const requiredClearance = Math.max(minCutoffFt, truckHeightFt + safetyMarginFt);

  const hazards = {
    lowBridges: [],
    noTruckZones: [],
    residentialZones: []
  };

  // 1) Bridges: flag if bridge clearance < requiredClearance AND within buffer
  for (const b of bridges) {
    const clr = Number(b.clearance_ft);
    if (!Number.isFinite(clr)) continue;
    if (clr >= requiredClearance) continue;

    const bp = { lat: Number(b.latitude), lng: Number(b.longitude) };
    if (!Number.isFinite(bp.lat) || !Number.isFinite(bp.lng)) continue;

    for (const p of points) {
      if (haversineMeters(bp, p) <= bridgeBufferMeters) {
        hazards.lowBridges.push({
          id: b.id || b.structure_id || `${b.latitude},${b.longitude}`,
          latitude: bp.lat,
          longitude: bp.lng,
          clearance_ft: clr
        });
        break; // count once per bridge
      }
    }
  }

  // 2) Zones – if any route point lies inside polygon
  const checkZones = (zones, bucket) => {
    for (const z of zones) {
      const poly = z.polygon || [];
      if (!Array.isArray(poly) || !poly.length) continue;
      for (const p of points) {
        if (pointInPolygon(p, poly)) {
          hazards[bucket].push({ id: z.id, name: z.name });
          break;
        }
      }
    }
  };
  checkZones(noTruckZones, 'noTruckZones');
  checkZones(residentialZones, 'residentialZones');

  const score =
    hazards.lowBridges.length * 10 + // most critical
    hazards.noTruckZones.length * 5 +
    hazards.residentialZones.length * 3;

  return { hazards, score };
}

// ---------- Debug helpers ----------

// Quick “nearest low bridge” to a point (for validation)
router.get('/nearest-bridge', (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radius = Number(req.query.radiusm || 500);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat,lng required' });
  }
  const here = { lat, lng };
  const within = [];
  for (const b of bridges) {
    const bp = { lat: Number(b.latitude), lng: Number(b.longitude) };
    const d = haversineMeters(here, bp);
    if (d <= radius) within.push({ id: b.id, clearance_ft: b.clearance_ft, lat: bp.lat, lng: bp.lng, dist_m: Math.round(d) });
  }
  within.sort((a, b) => a.dist_m - b.dist_m);
  res.json({ count: within.length, bridges: within.slice(0, 10) });
});

router.get('/ping', (req, res) => res.json({ ok: true, where: 'routes/routing.js' }));

// ---------- Main route ----------

router.post('/safe-route', async (req, res) => {
  try {
    const { origin, destination, originAddress, destinationAddress, truck, tuning } = req.body || {};
    if (!(origin && destination) && !(originAddress && destinationAddress)) {
      return res.status(400).json({ error: 'origin/destination (coords) OR originAddress/destinationAddress are required' });
    }
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not set on server' });
    }

    // Build Directions params (prefer addresses if given)
    const params = {
      origin: originAddress ? originAddress : `${origin.lat},${origin.lng}`,
      destination: destinationAddress ? destinationAddress : `${destination.lat},${destination.lng}`,
      mode: 'driving',
      alternatives: true,
      departure_time: 'now',
      key: process.env.GOOGLE_MAPS_API_KEY
    };

    const response = await client.directions({ params, timeout: 15000 });
    const routes = response.data.routes || [];
    if (!routes.length) {
      return res.status(502).json({ error: 'No routes returned from Google Directions' });
    }

    // Evaluate hazards per route using overview polyline
    const evaluated = routes.map((r, idx) => {
      const enc = r.overview_polyline?.points;
      const pts = enc ? decodePolyline(enc) : [];
      const { hazards, score } = scoreRoute(pts, {
        truckHeightFt: Number(truck?.height_ft) || 13.6,
        bridgeBufferMeters: Number(tuning?.bridgeBufferMeters) || 120
      });

      // Flatten some fields for frontend
      const leg = r.legs?.[0];
      return {
        index: idx,
        encoded: enc || null,
        summary: r.summary || '',
        distance_m: leg?.distance?.value ?? null,
        duration_s: leg?.duration_in_traffic?.value ?? leg?.duration?.value ?? null,
        hazards,
        score
      };
    });

    // Choose safest (score 0 if any; else lowest score)
    const safe = evaluated.find(e => e.score === 0);
    const best = safe || evaluated.reduce((a, b) => (a.score <= b.score ? a : b));

    return res.json({
      chosenRouteIndex: best.index,
      chosenRouteHazards: best.hazards,
      routes: evaluated,
      usedTruckProfile: { height_ft: Number(truck?.height_ft) || 13.6 },
      usedTuning: { bridgeBufferMeters: Number(tuning?.bridgeBufferMeters) || 120 }
    });

  } catch (err) {
    console.error('safe-route error:', err?.response?.data || err.message);
    return res.status(500).json({
      error: 'Error fetching directions',
      detail: err?.response?.data || err.message
    });
  }
});

module.exports = router;
