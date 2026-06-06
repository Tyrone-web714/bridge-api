const fs = require('fs');
const path = require('path');
const supervisorIntelligence = require('../services/supervisorIntelligence');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const routeSource = fs.readFileSync(
  path.join(__dirname, '..', 'routes', 'supervisorIntelligence.js'),
  'utf8'
);
const schemaSource = fs.readFileSync(
  path.join(__dirname, '..', 'db', 'postgres.js'),
  'utf8'
);
const serverSource = fs.readFileSync(
  path.join(__dirname, '..', 'server.js'),
  'utf8'
);

[
  "router.get('/alerts'",
  "router.patch('/alerts/:id'",
  "router.get('/schedules'",
  "router.post('/schedules/:id/run'",
  "router.get('/reports'"
].forEach((contract) => assert(routeSource.includes(contract), `Missing route contract: ${contract}`));

[
  'CREATE TABLE IF NOT EXISTS supervisor_alerts',
  'CREATE TABLE IF NOT EXISTS scheduled_report_schedules',
  'CREATE TABLE IF NOT EXISTS scheduled_reports'
].forEach((contract) => assert(schemaSource.includes(contract), `Missing schema contract: ${contract}`));

assert(
  serverSource.includes("app.use('/api/supervisor-intelligence'"),
  'Supervisor intelligence routes are not mounted.'
);
assert(
  serverSource.includes('supervisorIntelligence.start()'),
  'Scheduled report runner is not started.'
);

const report = supervisorIntelligence.deterministicReport({
  routeDate: '2026-06-05',
  routePrediction: {
    routes: [{
      routeId: 'route-1',
      routeNumber: 'R-1',
      paceStatus: 'high_risk',
      remainingStopCount: 3,
      scheduleVarianceMinutes: 35,
      confidence: 'medium'
    }]
  },
  failurePrediction: { riskLevel: 'high' },
  demandPrediction: {
    confidence: 'medium',
    products: [{ productName: 'Coca-Cola 12 Pack', direction: 'increasing' }]
  },
  undeliveredStops: [{
    routeNumber: 'R-1',
    stopSequence: 2,
    accountName: 'Test Account',
    nonDeliveryReason: 'business closed'
  }]
});

assert(report.summary.includes('1 route(s) analyzed'), 'Report route summary is incorrect.');
assert(report.priorities.length >= 2, 'Report priorities were not generated.');
assert(report.routeRisks.length === 1, 'Route risk was not included.');
assert(report.deliveryRisks.length >= 2, 'Delivery risks were not included.');

console.log('[test:supervisor-intelligence] alerts, schedules, reports, runner, and deterministic report contracts verified.');
