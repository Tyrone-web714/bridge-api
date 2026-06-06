const DAY_MS = 24 * 60 * 60 * 1000;

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(asNumber(value) * factor) / factor;
}

function percentChange(current, previous) {
  const currentValue = asNumber(current);
  const previousValue = asNumber(previous);
  if (previousValue === 0) return currentValue === 0 ? 0 : null;
  return round(((currentValue - previousValue) / Math.abs(previousValue)) * 100, 1);
}

function rate(numerator, denominator) {
  const total = asNumber(denominator);
  return total > 0 ? round(asNumber(numerator) / total, 4) : null;
}

function confidenceForSample(sampleCount, thresholds = {}) {
  const medium = asNumber(thresholds.medium) || 4;
  const high = asNumber(thresholds.high) || 12;
  if (sampleCount >= high) return 'high';
  if (sampleCount >= medium) return 'medium';
  return 'low';
}

function addDays(dateValue, days) {
  if (!dateValue || !Number.isFinite(Number(days))) return null;
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Math.round(Number(days)));
  return date.toISOString().slice(0, 10);
}

function daysBetween(startValue, endValue) {
  if (!startValue || !endValue) return null;
  const start = new Date(`${String(startValue).slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${String(endValue).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS));
}

function buildSourceCoverage({
  sourcePeriodStart,
  sourcePeriodEnd,
  sampleCount,
  priorSampleCount = 0,
  requiredFields = [],
  presentFields = []
}) {
  const required = new Set(requiredFields);
  const present = new Set(presentFields);
  const populatedRequiredFields = [...required].filter((field) => present.has(field)).length;
  return {
    sourcePeriodStart: sourcePeriodStart || null,
    sourcePeriodEnd: sourcePeriodEnd || null,
    sampleCount: asNumber(sampleCount),
    priorSampleCount: asNumber(priorSampleCount),
    requiredFieldCount: required.size,
    populatedRequiredFieldCount: populatedRequiredFields,
    coverageRatio: required.size ? round(populatedRequiredFields / required.size, 3) : 1
  };
}

function buildAccountForecast(signals = {}) {
  const current = signals.currentPeriod || {};
  const previous = signals.previousPeriod || {};
  const orderCount = asNumber(current.orderCount);
  const previousOrderCount = asNumber(previous.orderCount);
  const averageOrderIntervalDays = signals.averageOrderIntervalDays == null
    ? null
    : round(signals.averageOrderIntervalDays, 1);
  const expectedNextOrderDate = addDays(current.lastOrderDate, averageOrderIntervalDays);
  const daysSinceLastOrder = daysBetween(current.lastOrderDate, signals.asOfDate);
  const failureRate = rate(current.undeliveredStopCount, current.finishedStopCount);
  const deductionRate = rate(current.deductionAmount, current.subtotalAmount);
  const sourceCoverage = buildSourceCoverage({
    sourcePeriodStart: current.periodStart,
    sourcePeriodEnd: current.periodEnd,
    sampleCount: orderCount,
    priorSampleCount: previousOrderCount,
    requiredFields: ['orders', 'products', 'routeStops'],
    presentFields: [
      orderCount > 0 ? 'orders' : null,
      (signals.products || []).length > 0 ? 'products' : null,
      asNumber(current.routeStopCount) > 0 ? 'routeStops' : null
    ].filter(Boolean)
  });

  let reorderStatus = 'insufficient_history';
  if (expectedNextOrderDate && daysSinceLastOrder != null) {
    const expectedInterval = Math.max(1, averageOrderIntervalDays);
    if (daysSinceLastOrder >= expectedInterval * 1.2) reorderStatus = 'overdue';
    else if (daysSinceLastOrder >= expectedInterval * 0.8) reorderStatus = 'due_soon';
    else reorderStatus = 'not_due';
  }

  return {
    engineVersion: 'deterministic-v1',
    entityType: 'account',
    entityId: signals.accountNumber || null,
    generatedAt: new Date().toISOString(),
    confidence: confidenceForSample(orderCount + previousOrderCount, { medium: 4, high: 12 }),
    sourceCoverage,
    currentPeriod: current,
    previousPeriod: previous,
    metrics: {
      orderCountChangePercent: percentChange(orderCount, previousOrderCount),
      netRevenueChangePercent: percentChange(current.netAmount, previous.netAmount),
      quantityChangePercent: percentChange(current.itemQuantity, previous.itemQuantity),
      averageOrderValue: orderCount > 0 ? round(asNumber(current.netAmount) / orderCount) : null,
      averageOrderIntervalDays,
      daysSinceLastOrder,
      expectedNextOrderDate,
      reorderStatus,
      deliveryFailureRate: failureRate,
      deductionRate
    },
    productTrends: (signals.products || []).map((product) => ({
      ...product,
      quantityChangePercent: percentChange(product.currentQuantity, product.previousQuantity),
      netRevenueChangePercent: percentChange(product.currentNetAmount, product.previousNetAmount)
    }))
  };
}

function buildProductDemandForecast(signals = [], options = {}) {
  const products = signals.map((product) => {
    const currentQuantity = asNumber(product.currentQuantity ?? product.quantity);
    const previousQuantity = asNumber(product.previousQuantity);
    const quantityChangePercent = percentChange(currentQuantity, previousQuantity);
    let direction = 'stable';
    if (quantityChangePercent === null && currentQuantity > 0) direction = 'new_or_reactivated';
    else if (quantityChangePercent > 10) direction = 'increasing';
    else if (quantityChangePercent < -10) direction = 'decreasing';
    return {
      ...product,
      currentQuantity,
      previousQuantity,
      quantityChangePercent,
      netRevenueChangePercent: percentChange(
        product.currentNetAmount ?? product.netAmount,
        product.previousNetAmount
      ),
      direction,
      confidence: confidenceForSample(
        asNumber(product.currentOrderCount ?? product.orderCount)
          + asNumber(product.previousOrderCount),
        { medium: 4, high: 12 }
      )
    };
  });
  const sampleCount = products.reduce(
    (sum, product) => sum + asNumber(product.currentOrderCount ?? product.orderCount),
    0
  );
  const priorSampleCount = products.reduce(
    (sum, product) => sum + asNumber(product.previousOrderCount),
    0
  );

  return {
    engineVersion: 'deterministic-v1',
    entityType: options.accountNumber ? 'account_product_demand' : 'network_product_demand',
    entityId: options.accountNumber || 'all',
    generatedAt: new Date().toISOString(),
    confidence: confidenceForSample(sampleCount + priorSampleCount, { medium: 8, high: 30 }),
    sourceCoverage: buildSourceCoverage({
      sourcePeriodStart: options.sourcePeriodStart,
      sourcePeriodEnd: options.sourcePeriodEnd,
      sampleCount,
      priorSampleCount,
      requiredFields: ['productOrders'],
      presentFields: products.length ? ['productOrders'] : []
    }),
    products
  };
}

function buildDeliveryFailurePrediction(signals = {}) {
  const current = signals.currentPeriod || {};
  const previous = signals.previousPeriod || {};
  const currentRate = rate(current.undeliveredStopCount, current.finishedStopCount);
  const previousRate = rate(previous.undeliveredStopCount, previous.finishedStopCount);
  const sampleCount = asNumber(current.finishedStopCount);
  const priorSampleCount = asNumber(previous.finishedStopCount);
  const failureRateChangePercentagePoints = currentRate == null || previousRate == null
    ? null
    : round((currentRate - previousRate) * 100, 1);
  let riskLevel = 'unknown';
  if (currentRate != null) {
    if (currentRate >= 0.15) riskLevel = 'high';
    else if (currentRate >= 0.05) riskLevel = 'medium';
    else riskLevel = 'low';
  }

  return {
    engineVersion: 'deterministic-v1',
    entityType: signals.accountNumber ? 'account_delivery_failure' : 'network_delivery_failure',
    entityId: signals.accountNumber || 'all',
    generatedAt: new Date().toISOString(),
    confidence: confidenceForSample(sampleCount + priorSampleCount, { medium: 8, high: 25 }),
    sourceCoverage: buildSourceCoverage({
      sourcePeriodStart: current.periodStart,
      sourcePeriodEnd: current.periodEnd,
      sampleCount,
      priorSampleCount,
      requiredFields: ['finishedStops', 'failureReasons'],
      presentFields: [
        sampleCount ? 'finishedStops' : null,
        (signals.failureReasons || []).length ? 'failureReasons' : null
      ].filter(Boolean)
    }),
    riskLevel,
    currentFailureRate: currentRate,
    previousFailureRate: previousRate,
    failureRateChangePercentagePoints,
    currentPeriod: current,
    previousPeriod: previous,
    failureReasons: signals.failureReasons || []
  };
}

function buildRouteCompletionPredictions(routeSignals = [], options = {}) {
  const generatedAt = new Date();
  const routes = routeSignals.map((route) => {
    const varianceMinutes = asNumber(route.scheduleVarianceMinutes);
    const remainingMinutes = Math.max(0, asNumber(route.remainingPlannedMinutes));
    const delayCarryForward = Math.max(0, varianceMinutes);
    const predictedRemainingMinutes = remainingMinutes + delayCarryForward;
    const activityTime = route.latestActualActivityAt
      ? new Date(route.latestActualActivityAt)
      : generatedAt;
    const validActivityTime = Number.isNaN(activityTime.getTime()) ? generatedAt : activityTime;
    const predictedCompletionAt = route.remainingStopCount > 0
      ? new Date(validActivityTime.getTime() + predictedRemainingMinutes * 60000).toISOString()
      : route.completedAt || route.latestActualActivityAt || null;
    let paceStatus = 'on_pace';
    if (route.completedAt) paceStatus = 'completed';
    else if (varianceMinutes >= 30 || route.undeliveredStopCount > 0) paceStatus = 'high_risk';
    else if (varianceMinutes >= 10) paceStatus = 'at_risk';

    const observedStops = asNumber(route.finishedStopCount);
    return {
      routeId: route.id,
      routeNumber: route.routeNumber,
      routeDate: route.routeDate,
      assignedDriverId: route.assignedDriverId,
      assignedDriverName: route.assignedDriverName,
      paceStatus,
      predictedCompletionAt,
      predictedRemainingMinutes,
      scheduleVarianceMinutes: route.scheduleVarianceMinutes,
      remainingStopCount: route.remainingStopCount,
      undeliveredStopCount: route.undeliveredStopCount,
      confidence: confidenceForSample(observedStops, { medium: 2, high: 6 })
    };
  });

  return {
    engineVersion: 'deterministic-v1',
    entityType: 'route_date',
    entityId: options.routeDate || null,
    generatedAt: generatedAt.toISOString(),
    confidence: confidenceForSample(
      routes.reduce((sum, route) => sum + asNumber(route.remainingStopCount), 0) + routes.length,
      { medium: 4, high: 12 }
    ),
    sourceCoverage: buildSourceCoverage({
      sourcePeriodStart: options.routeDate,
      sourcePeriodEnd: options.routeDate,
      sampleCount: routes.length,
      requiredFields: ['routes'],
      presentFields: routes.length ? ['routes'] : []
    }),
    routes
  };
}

module.exports = {
  buildAccountForecast,
  buildDeliveryFailurePrediction,
  buildProductDemandForecast,
  buildRouteCompletionPredictions,
  confidenceForSample,
  percentChange
};
