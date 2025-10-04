// routes/routing.js
const express = require('express');
const { Client } = require('@googlemaps/google-maps-services-js');
const router = express.Router();

const client = new Client({});

// Data sets produced at build-time
const bridges = require('../data/low_clearance_bridges.json');        // [{id, latitude, longitude, clearance_ft, ...}]
let noTruckZones = [];
let residentialZones = [];
try { noTruckZones = require('../data/no_truck_zones.json'); } catch {}
try { residentialZones = require('../data/residential_zones.json'); } catch {}

// ----------------- helpers -----------------

// Haversine (meters)
function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Ray-casting point in polygon
function pointInPolygon(point, polygon) {
  let x = point.lat, y = point.lng, inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const inter = ((yi > y) !== (yj > y)) && (x < (xj - xi)*(y - yi)/(yj - yi) + xi);
    if (inter) inside = !inside;
  }
  return inside;
}

// Decode a Google encoded polyline to [{lat,lng}]
function decodePolyline(str) {
  let index = 0, lat = 0, lng = 0, out = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

// Build a *dense* path for scoring: concat all steps’ polylines (first leg)
function densePathFromRoute(googleRoute) {
  const leg = googleRoute?.legs?.[0];
  if (!leg?.steps?.length) return [];
  const pts = [];
  for (const step of leg.steps) {
    const enc = step.polyline?.points;
    if (enc) {
      const seg = decodePolyline(enc);
      // avoid duplicate point joins
      if (pts.length && seg.length && (pts[pts.length-1].lat === seg[0].lat) && (pts[pts.length-1].lng === seg[0].lng)) {
        pts.push(...seg.slice(1));
      } else {
        pts.push(...seg);
      }
    }
  }
  return pts;
}

// Hazard scoring
function scoreRoute(points, opts) {
  const {
    truckHeightFt = 13.5,
    bridgeBufferMeters = 120
  } = opts || {};

  const SAFE_EXTRA_FT = 0.5; // safety margin
  const thresholdFt = truckHeightFt + SAFE_EXTRA_FT;

  const hazards = {
    lowBridges: [],
    noTruckZones: [],
    residentialZones: []
  };

  // 1) Low bridges within buffer
  for (const b of bridges) {
    const clr = Number(b.clearance_ft);
    if (!(clr >= 0)) continue;
    if (clr >= thresholdFt) continue; // only flag if below truck+margin

    const bp = { lat: Number(b.latitude), lng: Number(b.longitude) };
    if (!(bp.lat && bp.lng)) continue;

    for (const p of points) {
      if (haversineMeters(bp, p) <= bridgeBufferMeters) {
        hazards.lowBridges.push({
          id: b.id || b.structure_id || `${bp.lat},${bp.lng}`,
          latitude: bp.lat, longitude: bp.lng, clearance_ft: clr
        });
        break; // count once per bridge
      }
    }
  }

  // 2) Zone checks (point-in-polygon)
  const checkZones = (zones, key) => {
    for (const z of zones || []) {
      const poly = Array.isArray(z.polygon) ? z.polygon : [];
      if (!poly.length) continue;
      for (const p of points) {
        if (pointInPolygon(p, poly)) {
          hazards[key].push({ id: z.id || z.name, name: z.name || key });
          break;
        }
      }
    }
  };
  checkZones(noTruckZones, 'noTruckZones');
  checkZones(residentialZones, 'residentialZones');

  // Simple weighted score
  const score = hazards.lowBridges.length * 10
              + hazards.noTruckZones.length * 5
              + hazards.residentialZones.length * 3;

  return { hazards, score };
}

// ----------------- routes -----------------

router.post('/safe-route', async (req, res) => {
  try {
    const {
      origin, destination, originAddress, destinationAddress,
      truck = {}, tuning = {}
    } = req.body || {};

    if ((!origin || !destination) && (!originAddress || !destinationAddress)) {
      return res.status(400).json({ error: 'Provide origin+destination coords or originAddress+destinationAddress' });
    }
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not set on server' });
    }

    // Build params, support either addresses or lat/lng
    const params = {
      origin: originAddress ? originAddress : `${origin.lat},${origin.lng}`,
      destination: destinationAddress ? destinationAddress : `${destination.lat},${destination.lng}`,
      mode: 'driving',
      alternatives: true,
      departure_time: 'now',
      key: process.env.GOOGLE_MAPS_API_KEY
    };

    const resp = await client.directions({ params, timeout: 20000 });
    const routes = resp.data?.routes || [];
    if (!routes.length) {
      return res.status(502).json({ error: 'No routes returned from Google Directions', detail: resp.data });
    }

    // Evaluate all alternatives with dense points
    const evaluated = routes.map((r, idx) => {
      const dense = densePathFromRoute(r);
      const { hazards, score } = scoreRoute(dense, {
        truckHeightFt: Number(truck.height_ft) || 13.5,
        bridgeBufferMeters: Number(tuning.bridgeBufferMeters) || 120
      });

      // front-end helpers
      const summary = r.summary || '';
      const dist = r.legs?.[0]?.distance?.value ?? null;   // meters
      const dur  = r.legs?.[0]?.duration_in_traffic?.value
                ?? r.legs?.[0]?.duration?.value ?? null;   // seconds
      const encoded = r.overview_polyline?.points || null;

      return {
        index: idx,
        encoded,
        summary,
        distance_m: dist,
        duration_s: dur,
        hazards,
        score,
        // keep the original for debugging if needed
        _raw: undefined // strip raw from payload (reduce size)
      };
    });

    // Pick safest (fewest hazards; then shortest duration)
    const best = evaluated
      .slice()
      .sort((a, b) => (a.score - b.score) || ((a.duration_s ?? 9e15) - (b.duration_s ?? 9e15)))[0];

    return res.json({
      chosenRouteIndex: best.index,
      chosenRouteHazards: best.hazards,
      routes: evaluated,
      usedTruckProfile: { height_ft: Number(truck.height_ft) || 13.5 },
      usedTuning: { bridgeBufferMeters: Number(tuning.bridgeBufferMeters) || 120 }
    });

  } catch (err) {
    console.error('safe-route error:', err?.response?.data || err);
    return res.status(500).json({
      error: 'Error fetching directions',
      detail: err?.response?.data || err.message || String(err)
    });
  }
});

module.exports = router;
