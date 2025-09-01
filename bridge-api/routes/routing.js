const express = require('express');
const { Client } = require('@googlemaps/google-maps-services-js');
const router = express.Router();

const client = new Client({});
const bridges = require('../data/low_clearance_bridges.json');
const noTruckZones = require('../data/no_truck_zones.json');
const residentialZones = require('../data/residential_zones.json');

function pointInPolygon(point, polygon) {
  let x = point.lat, y = point.lng;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].lat, yi = polygon[i].lng;
    let xj = polygon[j].lat, yj = polygon[j].lng;
    let intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

router.post('/safe-route', async (req, res) => {
  const { origin, destination } = req.body;

  let hazards = { lowBridges: [], noTruckZones: [], residentialZones: [] };

  try {
    const response = await client.directions({
      params: {
        origin: `${origin.lat},${origin.lng}`,
        destination: `${destination.lat},${destination.lng}`,
        mode: "driving",
        alternatives: true,
        key: process.env.GOOGLE_MAPS_API_KEY
      }
    });

    const safeRoute = response.data.routes.find(route => {
      return !route.legs.some(leg =>
        leg.steps.some(step => {
          const lat = step.start_location.lat;
          const lng = step.start_location.lng;

          const inNoTruck = noTruckZones.some(zone => pointInPolygon({lat, lng}, zone.polygon));
          const inResidential = residentialZones.some(zone => pointInPolygon({lat, lng}, zone.polygon));
          const nearBridge = bridges.some(b => 
            b.clearance_ft <= 13 &&
            Math.abs(lat - b.latitude) < 0.001 &&
            Math.abs(lng - b.longitude) < 0.001
          );

          return inNoTruck || inResidential || nearBridge;
        })
      );
    });

    res.json({
      hazards,
      chosenRoute: safeRoute || response.data.routes[0],
      alternateRoutes: response.data.routes
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching directions" });
  }
});

module.exports = router;
