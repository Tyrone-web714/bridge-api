// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// --- Core middleware ---
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// --- Serve the front-end from /public (index.html, app.js, etc.) ---
app.use(express.static(path.join(__dirname, 'public')));

// --- Optional: disable browser caching for bridges API to avoid 304/empty bodies ---
app.use((req, res, next) => {
  if (req.path.startsWith('/api/bridges')) {
    res.set('Cache-Control', 'no-store');
  }
  next();
});

// --- Routes ---
const bridgeRoutes = require('./routes/bridges');
const driverRoutes = require('./routes/drivers');        // keep if present
const supervisorRoutes = require('./routes/supervisors'); // keep if present
const routingRoutes = require('./routes/routing');

app.use('/api/bridges', bridgeRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/supervisors', supervisorRoutes);
app.use('/api/routing', routingRoutes);

// --- Simple health endpoint ---
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// --- 404 for unknown API routes (let front-end handle its own paths) ---
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// --- Fallback: serve index.html for any non-API path (SPA-friendly) ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
