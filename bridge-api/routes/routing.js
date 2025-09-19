const express = require('express');
const { Client } = require('@googlemaps/google-maps-services-js');
const router = express.Router();

console.log('✅ routes/routing.js loaded');

const client = new Client({});

// DATA
const bridges = require('../data/low_clearance_bridges.json');        // [{id, latitude, longitude, clearance_ft, ...}]
const noTruckZones = require('../data/no_truck_zones.json');          // [{id, name, polygon:[{lat,lng}, ...]}]
const residentialZones = require('../data/residential_zones.json');   // same shape as above

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

// Google’s encoded polyline decoder (no extra deps)
function decodePolyline(str) {
  let index = 0, lat = 0, lng = 0, coordinates = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0; result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return coordinates;
}

// Count hazards for a polyline (array of {lat,lng})
function scoreRoute(points, { bridgeBufferMeters = 50, maxHeightFt = 13 } = {}) {
  const hazards = {
    lowBridges: [],
    noTruckZones: [],
    residentialZones: []
  };

  // 1) Bridges ≤ truck height within N meters of any point on the route
  for (const b of bridges) {
    if (b.clearance_ft == null || b.clearance_ft > maxHeightFt) continue;
    const bp = { lat: b.latitude, lng: b.longitude };
    for (const p of points) {
      if (haversineMeters(bp, p) <= bridgeBufferMeters) {
        hazards.lowBridges.push({
          id: b.id || b.structure_id || `${b.latitude},${b.longitude}`,
          latitude: b.latitude,
          longitude: b.longitude,
          clearance_ft: b.clearance_ft
        });
        break; // count once per bridge
      }
    }
  }

  // 2) Zones – if any route point lies inside polygon
  const checkZones = (zones, bucket) => {
    for (const z of zones) {
      const poly = z.polygon || [];
      if (!poly.length) continue;
      for (const p of points) {
        if (pointInPolygon(p, poly)) {
          hazards[bucket].push({ id: z.id, name: z.name });
          break; // count once per zone
        }
      }
    }
  };
  checkZones(noTruckZones, 'noTruckZones');
  checkZones(residentialZones, 'residentialZones');

  const score =
    hazards.lowBridges.length * 10 + // bridges are most critical
    hazards.noTruckZones.length * 5 +
    hazards.residentialZones.length * 3;

  return { hazards, score };
}

// ------- debug route (keep for now) -------
router.get('/ping', (req, res) => {
  res.json({ ok: true, where: 'routes/routing.js' });
});

// ------- route handler -------
router.post('/safe-route', async (req, res) => {
  console.log('➡️  POST /api/routing/safe-route received', req.body);

  try {
    const { origin, destination, truck = {}, tuning = {} } = req.body || {};
    const { height_ft = 13 /* default */, width_ft, weight_lbs } = truck;
    const { bridgeBufferMeters = 50 } = tuning;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'origin and destination are required' });
    }
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not set on server' });
    }

    // Call Google Directions with alternatives
    const response = await client.directions({
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: 'driving',
        alternatives: true,
        departure_time: 'now',
        key: process.env.GOOGLE_MAPS_API_KEY
      },
      timeout: 15000
    });

    const routes = response.data.routes || [];
    if (!routes.length) {
      return res.status(502).json({ error: 'No routes returned from Google Directions' });
    }

    // Evaluate hazards per route using overview polyline
    const evaluated = routes.map((r, idx) => {
      const enc = r.overview_polyline?.points;
      const pts = enc ? decodePolyline(enc) : [];
      const { hazards, score } = scoreRoute(
        pts,
        { bridgeBufferMeters, maxHeightFt: height_ft }
      );
      return { idx, route: r, hazards, score, pointsCount: pts.length };
    });

    // Pick a safe route if exists; else, the least hazardous
    const safe = evaluated.find(e => e.score === 0);
    const best = safe || evaluated.reduce((a, b) => (a.score <= b.score ? a : b));

    return res.json({
      chosenRouteIndex: best.idx,
      chosenRoute: best.route,            // full Google route object
      chosenRouteHazards: best.hazards,   // should be empty if safe
      routes: evaluated.map(e => ({
        index: e.idx,
        score: e.score,
        hazards: e.hazards
      })),
      usedTruckProfile: { height_ft, width_ft, weight_lbs },
      usedTuning: { bridgeBufferMeters }
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
