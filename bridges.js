const express = require('express');
const router = express.Router();
const bridgeData = require('../data/low_clearance_bridges.json');

router.get('/', (req, res) => {
  const { swLat, swLng, neLat, neLng } = req.query;

  const results = bridgeData.filter(b => {
    return (
      b.latitude >= parseFloat(swLat) &&
      b.latitude <= parseFloat(neLat) &&
      b.longitude >= parseFloat(swLng) &&
      b.longitude <= parseFloat(neLng)
    );
  });

  res.json(results);
});

module.exports = router;
