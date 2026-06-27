const assert = require('assert');
const predictionEngine = require('../services/predictionEngine');

const account = predictionEngine.buildAccountForecast({
  accountNumber: 'ACCT-1001',
  asOfDate: '2026-06-05',
  averageOrderIntervalDays: 7,
  currentPeriod: {
    periodStart: '2026-05-07',
    periodEnd: '2026-06-05',
    orderCount: 6,
    subtotalAmount: 1200,
    deductionAmount: 24,
    netAmount: 1176,
    itemQuantity: 240,
    lastOrderDate: '2026-06-01',
    routeStopCount: 6,
    finishedStopCount: 6,
    undeliveredStopCount: 1
  },
  previousPeriod: {
    periodStart: '2026-04-07',
    periodEnd: '2026-05-06',
    orderCount: 4,
    subtotalAmount: 800,
    deductionAmount: 8,
    netAmount: 792,
    itemQuantity: 160,
    routeStopCount: 4,
    finishedStopCount: 4,
    undeliveredStopCount: 0
  },
  products: [{
    sku: 'COLA-12',
    productName: 'Cola 12 Pack',
    currentQuantity: 120,
    currentNetAmount: 600,
    previousQuantity: 80,
    previousNetAmount: 400
  }]
});

assert.strictEqual(account.engineVersion, 'deterministic-v1');
assert.strictEqual(account.metrics.orderCountChangePercent, 50);
assert.strictEqual(account.metrics.quantityChangePercent, 50);
assert.strictEqual(account.metrics.expectedNextOrderDate, '2026-06-08');
assert.strictEqual(account.metrics.deliveryFailureRate, 0.1667);
assert.strictEqual(account.productTrends[0].quantityChangePercent, 50);

const failure = predictionEngine.buildDeliveryFailurePrediction({
  accountNumber: 'ACCT-1001',
  currentPeriod: {
    periodStart: '2026-05-07',
    periodEnd: '2026-06-05',
    finishedStopCount: 20,
    undeliveredStopCount: 3
  },
  previousPeriod: {
    periodStart: '2026-04-07',
    periodEnd: '2026-05-06',
    finishedStopCount: 20,
    undeliveredStopCount: 1
  },
  failureReasons: [{ reason: 'business_closed', count: 2 }]
});

assert.strictEqual(failure.riskLevel, 'high');
assert.strictEqual(failure.currentFailureRate, 0.15);
assert.strictEqual(failure.failureRateChangePercentagePoints, 10);
assert.strictEqual(failure.confidence, 'high');

const demand = predictionEngine.buildProductDemandForecast([{
  sku: 'WATER-24',
  productName: 'Bottled Water 24 Pack',
  currentOrderCount: 8,
  previousOrderCount: 6,
  currentQuantity: 150,
  previousQuantity: 100,
  currentNetAmount: 900,
  previousNetAmount: 600
}], {
  sourcePeriodStart: '2026-05-07',
  sourcePeriodEnd: '2026-06-05'
});

assert.strictEqual(demand.products[0].direction, 'increasing');
assert.strictEqual(demand.products[0].quantityChangePercent, 50);
assert.strictEqual(demand.products[0].confidence, 'high');

const completion = predictionEngine.buildRouteCompletionPredictions([{
  id: 'route-1',
  routeDate: '2026-06-05',
  routeNumber: 'R-101',
  remainingStopCount: 3,
  remainingPlannedMinutes: 60,
  scheduleVarianceMinutes: 15,
  finishedStopCount: 4,
  undeliveredStopCount: 0,
  latestActualActivityAt: '2026-06-05T15:00:00.000Z'
}], { routeDate: '2026-06-05' });

assert.strictEqual(completion.routes[0].paceStatus, 'at_risk');
assert.strictEqual(completion.routes[0].predictedRemainingMinutes, 75);
assert.strictEqual(completion.routes[0].predictedCompletionAt, '2026-06-05T16:15:00.000Z');

console.log('[test:predictions] deterministic forecast calculations verified.');
