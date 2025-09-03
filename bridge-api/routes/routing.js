const express = require('express');
const router = express.Router();

router.post('/safe-route', async (req, res) => {
  const { origin, destination } = req.body;

  // Just echo back the request for now
  res.json({
    message: "Routing API working",
    origin,
    destination
  });
});

module.exports = router;

 
       
