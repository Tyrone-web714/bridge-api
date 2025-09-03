const express = require('express');
const router = express.Router();

// just echo back the request for now
router.post('/safe-route', (req, res) => {
  const { origin, destination } = req.body;
  res.json({
    message: "Routing API working",
    origin,
    destination
  });
});

module.exports = router;

 
       

