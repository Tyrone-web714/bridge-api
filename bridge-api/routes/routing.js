const express = require('express');
const router = express.Router();

// Log to prove this file loaded at runtime
console.log('✅ routes/routing.js loaded');

router.post('/safe-route', (req, res) => {
  const { origin, destination } = req.body || {};
  return res.json({
    message: 'Routing API working',
    origin,
    destination
  });
});

module.exports = router;


 
       


