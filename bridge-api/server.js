const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Import routes
const bridgeRoutes = require('./routes/bridges');
const driverRoutes = require('./routes/drivers');
const supervisorRoutes = require('./routes/supervisors');
const routingRoutes = require('./routes/routing');

app.use('/api/bridges', bridgeRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/supervisors', supervisorRoutes);
app.use('/api/routing', routingRoutes);

// --- TEMP inline routing test (remove after we confirm) ---
app.get('/api/routing/ping', (req, res) => {
  console.log('✅ INLINE /api/routing/ping reached');
  res.json({ ok: true, via: 'INLINE server.js' });
});

app.post('/api/routing/safe-route', (req, res) => {
  console.log('✅ INLINE POST /api/routing/safe-route reached', req.body);
  res.json({ ok: true, via: 'INLINE server.js' });
});
// --- END TEMP ---

// Optional: handle root to avoid ENOENT error if public/index.html is missing
app.get('/', (req, res) => {
  res.send('<h1>Bridge API is running ✅</h1><p>Try /api/bridges or /api/routing/ping</p>');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
