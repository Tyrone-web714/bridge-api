const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const postgres = require('./db/postgres');
const photoStorage = require('./services/photoStorage');
const driverAuth = require('./services/driverAuth');
const aiProvider = require('./services/aiProvider');
const supervisorIntelligence = require('./services/supervisorIntelligence');
const auditLog = require('./services/auditLog');
const { createRateLimiter, positiveInteger } = require('./middleware/securityControls');

dotenv.config();

const app = express();
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '1mb';
const DELIVERY_BODY_LIMIT = process.env.DELIVERY_BODY_LIMIT || '30mb';
const MANIFEST_BODY_LIMIT = process.env.MANIFEST_BODY_LIMIT || '12mb';
const IMPORT_BODY_LIMIT = process.env.IMPORT_BODY_LIMIT || '15mb';
const SLOW_REQUEST_MS = Number.parseInt(process.env.SLOW_REQUEST_MS, 10) || 2000;
const READINESS_TIMEOUT_MS = Number.parseInt(process.env.READINESS_TIMEOUT_MS, 10) || 2500;
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins
}));
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= SLOW_REQUEST_MS || res.statusCode >= 500) {
      console.warn(`${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs}ms requestId=${requestId}`);
    }
  });

  next();
});
app.use(createRateLimiter({
  name: 'global',
  windowMs: positiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: positiveInteger(process.env.RATE_LIMIT_GLOBAL_MAX, 1200)
}));
app.use('/api/routing/manual-hazards/admin/login', createRateLimiter({
  name: 'admin-login',
  max: positiveInteger(process.env.RATE_LIMIT_AUTH_MAX, 12)
}));
app.use('/api/places', createRateLimiter({
  name: 'places',
  max: positiveInteger(process.env.RATE_LIMIT_PLACES_MAX, 240)
}));
app.use('/api/routing', createRateLimiter({
  name: 'driver-routing',
  max: positiveInteger(process.env.RATE_LIMIT_DRIVER_MAX, 600)
}));
app.use('/api/route-manifests/driver', createRateLimiter({
  name: 'driver-manifests',
  max: positiveInteger(process.env.RATE_LIMIT_DRIVER_MAX, 600)
}));
app.use('/api/ai', createRateLimiter({
  name: 'ai',
  max: positiveInteger(process.env.RATE_LIMIT_AI_MAX, 60)
}));
app.use('/api/delivery-notes', createRateLimiter({
  name: 'delivery-notes',
  max: positiveInteger(process.env.RATE_LIMIT_UPLOAD_MAX, 120)
}));
app.use('/api/data-imports', createRateLimiter({
  name: 'data-imports',
  max: positiveInteger(process.env.RATE_LIMIT_UPLOAD_MAX, 120)
}));
app.use('/api/route-manifests/import', createRateLimiter({
  name: 'manifest-import',
  max: positiveInteger(process.env.RATE_LIMIT_UPLOAD_MAX, 120)
}));
app.use('/api/delivery-notes', express.json({ limit: DELIVERY_BODY_LIMIT }));
app.use('/api/route-manifests', express.json({ limit: MANIFEST_BODY_LIMIT }));
app.use('/api/data-imports', express.json({ limit: IMPORT_BODY_LIMIT }));
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(auditLog.mutationAuditMiddleware);

// Import routes
const bridgeRoutes = require('./routes/bridges');
const driverRoutes = require('./routes/drivers');
const supervisorRoutes = require('./routes/supervisors');
const routingRoutes = require('./routes/routing');
const placesRoutes = require('./routes/places');
const deliveryNotesRoutes = require('./routes/deliveryNotes');
const routeManifestRoutes = require('./routes/routeManifests');
const adminDashboardRoutes = require('./routes/adminDashboard');
const accountIntelligenceRoutes = require('./routes/accountIntelligence');
const aiRoutes = require('./routes/ai');
const operationalHeatmapRoutes = require('./routes/operationalHeatmaps');
const operationalGeographyRoutes = require('./routes/operationalGeography');
const dataImportRoutes = require('./routes/dataImports');
const supervisorIntelligenceRoutes = require('./routes/supervisorIntelligence');

app.use('/api/bridges', bridgeRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/supervisors', supervisorRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/delivery-notes', deliveryNotesRoutes);
app.use('/api/route-manifests', routeManifestRoutes);
app.use('/api/admin', adminDashboardRoutes);
app.use('/api/account-intelligence', accountIntelligenceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/operational-heatmaps', operationalHeatmapRoutes);
app.use('/api/operational-geography', operationalGeographyRoutes);
app.use('/api/data-imports', dataImportRoutes);
app.use('/api/supervisor-intelligence', supervisorIntelligenceRoutes);

app.get('/health', async (req, res) => {
  res.json({
    ok: true,
    service: 'bridge-api',
    database: postgres.isDatabaseConfigured() ? 'postgres' : 'json-fallback',
    postgis: await postgres.isPostgisEnabled(),
    photoStorage: photoStorage.getStorageStatus(),
    ai: aiProvider.getStatus(),
    driverAuth: driverAuth.isDriverAuthConfigured() ? 'configured' : 'not-configured',
    uptime_s: Math.round(process.uptime())
  });
});

app.get('/ready', async (req, res) => {
  let databaseReachable = false;
  let databaseError = null;
  const storageStatus = photoStorage.getStorageStatus();

  if (postgres.isDatabaseConfigured()) {
    try {
      const readinessQuery = postgres.rawQuery('SELECT 1 AS ok');
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`database readiness timed out after ${READINESS_TIMEOUT_MS}ms`)), READINESS_TIMEOUT_MS);
      });
      const result = await Promise.race([readinessQuery, timeout]);
      databaseReachable = result.rows[0]?.ok === 1;
    } catch (error) {
      databaseError = error.message;
    }
  }

  const checks = {
    googleMapsKey: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    adminPassword: Boolean(process.env.ADMIN_DASHBOARD_PASSWORD || process.env.SUPERVISOR_ADMIN_PASSWORD),
    adminSecret: Boolean(process.env.ADMIN_DASHBOARD_SECRET || process.env.SUPERVISOR_ADMIN_SECRET || process.env.ADMIN_DASHBOARD_PASSWORD),
    databaseConfigured: postgres.isDatabaseConfigured(),
    databaseReachable,
    postgis: await postgres.isPostgisEnabled(),
    photoStorageConfigured: storageStatus.configured,
    durablePhotoStorage: storageStatus.durable,
    driverAuth: driverAuth.isDriverAuthConfigured()
  };
  const ok = Object.values(checks).every(Boolean);

  res.status(ok ? 200 : 503).json({
    ok,
    service: 'bridge-api',
    checks,
    ai: aiProvider.getStatus(),
    ...(databaseError ? { databaseError } : {}),
    photoStorage: storageStatus,
    uptime_s: Math.round(process.uptime())
  });
});

app.get('/', (req, res) => {
  res.send('<h1>Bridge API is running</h1><p>Try /health or /api/routing/ping</p>');
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request payload is too large for this endpoint.'
    });
  }

  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  supervisorIntelligence.start();
});
server.keepAliveTimeout = Number.parseInt(process.env.SERVER_KEEP_ALIVE_TIMEOUT_MS, 10) || 65000;
server.headersTimeout = Number.parseInt(process.env.SERVER_HEADERS_TIMEOUT_MS, 10) || 66000;

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(
      `Server failed to start: port ${PORT} is already in use. Stop the existing backend process before starting another one.`
    );
    process.exit(1);
  }

  console.error('Server failed to start:', error);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing bridge-api cleanly...`);
  supervisorIntelligence.stop();
  server.close(async (error) => {
    if (error) {
      console.error('Error while closing HTTP server:', error);
      process.exit(1);
    }

    try {
      await postgres.closePool();
      console.log('Bridge API shut down cleanly.');
      process.exit(0);
    } catch (closeError) {
      console.error('Error while closing PostgreSQL pool:', closeError);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS, 10) || 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
