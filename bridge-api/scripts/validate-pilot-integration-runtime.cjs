require('dotenv').config();

const crypto = require('crypto');
const postgres = require('../db/postgres');
const repositories = require('../db/repositories');
const adminAuth = require('../services/adminAuth');
const warehouseAuth = require('../services/warehouseAuth');
const sharedSafety = require('../services/sharedSafety');
const biKpi = require('../services/biKpi');
const logistics = require('../services/logisticsIntelligence');
const fiss = require('../services/fleetIntelligenceScoring');
const rbac = require('../services/rbac');

function assert(condition, message) {
  if (!condition) throw new Error(`[pilot-integration] ${message}`);
}

function context(organizationId, role, actorId) {
  return {
    authenticated: true,
    actorType: role === rbac.ROLES.DRIVER ? 'driver' : 'admin_user',
    actorId,
    organizationId,
    approvedRole: role,
    role,
    permissions: rbac.permissionsForRole(role)
  };
}

async function seedOrganization(id, name) {
  await postgres.query(
    `INSERT INTO organizations (id, name, slug, status)
     VALUES ($1, $2, $1, 'active')
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = 'active', updated_at = NOW()`,
    [id, name]
  );
}

async function seedRoute({ runId, organizationId, driverNumber }) {
  const routeDate = new Date().toISOString().slice(0, 10);
  const manifestId = `pilot-route-${runId}`;
  const stopOneId = `pilot-stop-${runId}-1`;
  const stopTwoId = `pilot-stop-${runId}-2`;
  const routeNumber = `PILOT-${runId.slice(-8).toUpperCase()}`;
  await repositories.upsertDailyRouteManifest({
    id: manifestId,
    organizationId,
    routeDate,
    routeNumber,
    routeName: 'Pilot Integration Route',
    startLocation: 'Demo Distribution Center',
    plannedStartAt: `${routeDate}T08:00:00.000Z`,
    plannedEndAt: `${routeDate}T14:00:00.000Z`,
    totalStops: 2,
    totalPallets: 3,
    totalCases: 30,
    assignedDriverId: driverNumber,
    assignedDriverName: 'Demo Driver A',
    assignedAt: new Date().toISOString(),
    assignedBy: 'pilot-validator',
    status: 'assigned',
    raw: { source: 'pilot_integration_validator' }
  });
  await repositories.replaceDailyRouteStops(manifestId, [
    {
      id: stopOneId,
      stopSequence: 1,
      accountNumber: `ACCT-${runId}-1`,
      accountName: 'Demo Account One',
      destinationAddress: '100 Demo Way',
      city: 'San Antonio',
      stateCode: 'TX',
      postalCode: '78201',
      plannedArrivalAt: `${routeDate}T09:00:00.000Z`,
      plannedDepartureAt: `${routeDate}T09:30:00.000Z`,
      palletCount: 1,
      caseCount: 10,
      itemSummary: [{ sku: 'PILOT-COLA', quantity: 10 }],
      status: 'pending'
    },
    {
      id: stopTwoId,
      stopSequence: 2,
      accountNumber: `ACCT-${runId}-2`,
      accountName: 'Demo Account Two',
      destinationAddress: '200 Demo Road',
      city: 'San Antonio',
      stateCode: 'TX',
      postalCode: '78202',
      plannedArrivalAt: `${routeDate}T10:00:00.000Z`,
      plannedDepartureAt: `${routeDate}T10:30:00.000Z`,
      palletCount: 2,
      caseCount: 20,
      itemSummary: [{ sku: 'PILOT-WATER', quantity: 20 }],
      status: 'pending'
    }
  ]);
  await repositories.createAccountOrder({
    id: `pilot-order-${runId}-1`,
    accountNumber: `ACCT-${runId}-1`,
    accountName: 'Demo Account One',
    deliveryDate: routeDate,
    invoiceNumber: `INV-${runId}-1`,
    routeManifestId: manifestId,
    routeStopId: stopOneId,
    status: 'open',
    items: [
      { id: `pilot-item-${runId}-cola`, sku: 'PILOT-COLA', productName: 'Pilot Cola Case', quantity: 10, unitPrice: 8.5, brand: 'Pilot', packageSize: 'case' }
    ]
  });
  await repositories.createAccountOrder({
    id: `pilot-order-${runId}-2`,
    accountNumber: `ACCT-${runId}-2`,
    accountName: 'Demo Account Two',
    deliveryDate: routeDate,
    invoiceNumber: `INV-${runId}-2`,
    routeManifestId: manifestId,
    routeStopId: stopTwoId,
    status: 'open',
    items: [
      { id: `pilot-item-${runId}-water`, sku: 'PILOT-WATER', productName: 'Pilot Water Case', quantity: 20, unitPrice: 5.0, brand: 'Pilot', packageSize: 'case' }
    ]
  });
  return { routeDate, routeNumber, manifestId, stopOneId, stopTwoId };
}

async function completeStop(stopId, driverNumber, completionStatus, itemOverrides = {}) {
  const delivery = await repositories.getDriverStopDeliverySettlement(stopId, driverNumber);
  assert(delivery, `delivery settlement source should load for ${stopId}`);
  const items = delivery.settlement.items.map((item) => ({
    orderItemId: item.orderItemId,
    sku: item.sku,
    productName: item.productName,
    plannedQuantity: item.plannedQuantity,
    deliveredQuantity: itemOverrides.deliveredQuantity ?? item.plannedQuantity,
    rejectedQuantity: itemOverrides.rejectedQuantity || 0,
    damagedQuantity: itemOverrides.damagedQuantity || 0,
    missingQuantity: itemOverrides.missingQuantity || 0,
    returnedQuantity: itemOverrides.returnedQuantity || 0,
    addedQuantity: 0,
    unitPrice: item.unitPrice,
    adjustmentReason: itemOverrides.adjustmentReason || null
  }));
  const total = items.reduce((sum, item) => sum + (item.deliveredQuantity * item.unitPrice), 0);
  const settlement = await repositories.saveDriverStopDeliverySettlement(stopId, driverNumber, {
    status: 'completed',
    completionStatus,
    nonDeliveryReason: completionStatus === 'undelivered' ? 'business_closed' : null,
    paymentMethod: completionStatus === 'undelivered' ? 'unpaid' : 'cash',
    amountPaid: completionStatus === 'undelivered' ? 0 : total,
    customerSignature: 'validation-customer-signature',
    driverSignature: 'validation-driver-signature',
    notes: `Pilot integration ${completionStatus}`,
    items
  });
  assert(settlement?.settlement?.status === 'completed', 'delivery settlement should complete');
  const stop = await repositories.updateDailyRouteStopStatusForDriver(stopId, driverNumber, {
    status: completionStatus === 'undelivered' ? 'undelivered' : 'completed',
    nonDeliveryReason: completionStatus === 'undelivered' ? 'business_closed' : null,
    driverNotes: `Pilot integration ${completionStatus}`
  });
  assert(stop?.status === (completionStatus === 'undelivered' ? 'undelivered' : 'completed'), 'stop status should close');
  return { delivery, settlement, stop };
}

async function main() {
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required');
  assert(/127\.0\.0\.1:5544\d/.test(process.env.DATABASE_URL), 'runtime validation must use isolated local PostgreSQL on a 5544x validation port');

  const runId = `pilot-${Date.now()}`;
  const orgA = 'demo-fleet-a';
  const orgB = 'demo-fleet-b';
  const driverNumber = `D-${runId}`;
  const otherDriverNumber = `D-OTHER-${runId}`;
  const warehouseEmployeeId = `WH-${runId}`;
  const warehousePin = '246810';

  await seedOrganization(orgA, 'Demo Fleet A');
  await seedOrganization(orgB, 'Demo Fleet B');

  const orgAdmin = context(orgA, rbac.ROLES.ORGANIZATION_ADMIN, `org-admin-${runId}`);
  const supervisor = context(orgA, rbac.ROLES.SUPERVISOR, `supervisor-${runId}`);
  const driverContext = context(orgA, rbac.ROLES.DRIVER, `driver-${runId}`);
  const platformAdmin = context(orgA, rbac.ROLES.PLATFORM_ADMIN, `platform-admin-${runId}`);
  const orgBAdmin = context(orgB, rbac.ROLES.ORGANIZATION_ADMIN, `org-b-admin-${runId}`);

  const driver = await repositories.upsertDriver({
    organizationId: orgA,
    companyDriverNumber: driverNumber,
    driverName: 'Demo Driver A',
    active: true,
    teamName: 'Pilot Team',
    supervisorUsername: 'pilot-supervisor'
  }, 'pilot-validator');
  await repositories.setDriverPinHash(driver.legacyDriverId, adminAuth.hashPassword('135790'), 'pilot-validator');
  await repositories.upsertDriver({
    organizationId: orgB,
    companyDriverNumber: otherDriverNumber,
    driverName: 'Demo Driver B',
    active: true
  }, 'pilot-validator');
  await repositories.setDriverPinHash(
    repositories.getDriver ? (await repositories.getDriverByCompanyDriverNumber(otherDriverNumber, { organizationId: orgB })).legacyDriverId : otherDriverNumber,
    adminAuth.hashPassword('135790'),
    'pilot-validator'
  );

  await repositories.upsertWarehouseEmployee({
    organizationId: orgA,
    employeeId: warehouseEmployeeId,
    companyEmployeeId: warehouseEmployeeId,
    employeeName: 'Demo Warehouse Employee',
    pinHash: adminAuth.hashPassword(warehousePin),
    active: true
  }, 'pilot-validator');
  let employeeIdOnlyFailed = false;
  try {
    await warehouseAuth.authenticateWarehouseEmployee(warehouseEmployeeId, '', { organizationId: orgA });
  } catch (error) {
    employeeIdOnlyFailed = error.status === 400 || error.status === 401;
  }
  assert(employeeIdOnlyFailed, 'warehouse employee ID alone must fail');
  const warehouseEmployee = await warehouseAuth.authenticateWarehouseEmployee(warehouseEmployeeId, warehousePin, { organizationId: orgA });
  assert(warehouseEmployee.employee_id === warehouseEmployeeId, 'warehouse employee ID plus PIN should succeed');

  await repositories.upsertProduct({
    sku: 'PILOT-BONUS',
    productName: 'Pilot Bonus Case',
    brand: 'Pilot',
    packageSize: 'case',
    category: 'test',
    unitPrice: 3.25,
    barcodes: [`BC-${runId}`]
  });
  const route = await seedRoute({ runId, organizationId: orgA, driverNumber });
  const assigned = await repositories.getAssignedDailyRouteForDriver(driverNumber, route.routeDate, { organizationId: orgA });
  assert(assigned?.id === route.manifestId, 'assigned route should load for correct driver and Organization');
  const wrongOrgAssigned = await repositories.getAssignedDailyRouteForDriver(driverNumber, route.routeDate, { organizationId: orgB });
  assert(!wrongOrgAssigned, 'wrong Organization must not load assigned route');
  const wrongDriverAssigned = await repositories.getAssignedDailyRouteForDriver(otherDriverNumber, route.routeDate, { organizationId: orgA });
  assert(!wrongDriverAssigned, 'wrong driver must not load assigned route');

  let blockedBeforeDeparture = false;
  try {
    await repositories.updateDailyRouteStopStatusForDriver(route.stopOneId, driverNumber, { status: 'arrived' });
  } catch (error) {
    blockedBeforeDeparture = error.status === 409;
  }
  assert(blockedBeforeDeparture, 'route execution should require printed departure inventory');

  const departure = await repositories.prepareDepartureInventoryConfirmation(route.manifestId, driverNumber, warehouseEmployee);
  const persistedDeparture = await repositories.getDepartureInventoryConfirmation(route.manifestId, driverNumber);
  const departurePrintToken = departure?.printConfirmationToken
    || departure?.print_confirmation_token
    || persistedDeparture?.print_confirmation_token;
  assert(departurePrintToken, 'departure inventory confirmation should require print confirmation token');
  const printedDeparture = await repositories.confirmDepartureInventoryPrintForWarehouse(
    route.manifestId,
    driverNumber,
    warehouseEmployeeId,
    departurePrintToken
  );
  assert(printedDeparture?.printed_at, 'departure inventory print should complete');

  const addition = await repositories.addRouteTruckInventoryForDriver(route.manifestId, driverNumber, {
    barcode: `BC-${runId}`,
    quantity: 2,
    reason: 'customer requested additional product',
    clientOperationId: `inventory-add-${runId}`
  });
  const duplicateAddition = await repositories.addRouteTruckInventoryForDriver(route.manifestId, driverNumber, {
    barcode: `BC-${runId}`,
    quantity: 2,
    reason: 'customer requested additional product',
    clientOperationId: `inventory-add-${runId}`
  });
  assert(addition?.id === duplicateAddition?.id, 'truck inventory additions should be idempotent by client operation ID');

  await completeStop(route.stopOneId, driverNumber, 'completed');
  const stopTwoResult = await completeStop(route.stopTwoId, driverNumber, 'undelivered', {
    deliveredQuantity: 0,
    returnedQuantity: 20,
    adjustmentReason: 'business_closed'
  });
  const closedRoute = await repositories.getDailyRouteManifest(route.manifestId, { organizationId: orgA });
  assert(closedRoute.status === 'completed_with_exceptions', 'route should complete with exception status after undelivered stop');

  const returnInventory = await repositories.getRouteReturnInventorySummary(route.manifestId, driverNumber);
  const closeoutItems = returnInventory.items.map((item) => ({
    sku: item.sku,
    sellableQuantity: item.expectedReturnQuantity,
    returnedQuantity: 0,
    damagedQuantity: 0,
    rejectedQuantity: 0,
    notes: 'pilot integration balanced'
  }));
  const closeout = await repositories.prepareRouteInventoryCloseoutForDriver(route.manifestId, driverNumber, {
    warehouseEmployee: { employeeId: warehouseEmployeeId, employeeName: warehouseEmployee.employee_name },
    items: closeoutItems,
    notes: 'pilot integration final return inspection'
  });
  assert(closeout?.printConfirmationToken, 'final inventory closeout should require confirmed print');
  const printedCloseout = await repositories.confirmRouteInventoryCloseoutPrintForDriver(
    route.manifestId,
    driverNumber,
    closeout.printConfirmationToken
  );
  assert(printedCloseout?.printedAt, 'driver-side final inventory closeout print should complete');

  const kpiDefinition = await biKpi.createKpiDefinition(orgAdmin, {
    key: `pilot_route_completion_${runId}`,
    name: 'Pilot Route Completion',
    category: 'route_completion',
    unit: 'percent',
    status: 'active'
  });
  const effectiveFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const formula = await biKpi.createFormulaVersion(orgAdmin, kpiDefinition.id, {
    status: 'active',
    effectiveFrom,
    expression: {
      op: 'percentage',
      numerator: { op: 'input', name: 'closed_stops' },
      denominator: { op: 'input', name: 'planned_stops' },
      onZero: 'zero'
    },
    inputDefinitions: [
      { name: 'closed_stops', unit: 'count' },
      { name: 'planned_stops', unit: 'count' }
    ],
    thresholds: { good: 95, warning: 80, critical: 60 },
    roundingRules: { decimals: 2 }
  });
  const kpiSnapshot = await biKpi.calculateKpi(supervisor, kpiDefinition.id, {
    subjectType: 'route',
    subjectId: route.manifestId,
    periodStart: effectiveFrom,
    periodEnd: new Date().toISOString(),
    inputs: { closed_stops: 2, planned_stops: 2 },
    calculationRunKey: `pilot-kpi-${runId}`
  });
  assert(kpiSnapshot.formulaVersionId === formula.id && kpiSnapshot.calculatedValue === 100, 'KPI should calculate from integrated route data');

  await logistics.ingestEvent(orgAdmin, {
    eventType: 'route_delay',
    eventCategory: 'route_execution',
    sourceType: 'route_manifest',
    sourceId: route.manifestId,
    subjectType: 'route',
    subjectId: route.manifestId,
    routeId: route.manifestId,
    idempotencyKey: `route-delay-${runId}`,
    payload: { routeStatus: closedRoute.status, delayMinutes: 35, severity: 'high' }
  });
  await logistics.ingestEvent(orgAdmin, {
    eventType: 'delivery_exception',
    eventCategory: 'delivery_execution',
    sourceType: 'route_manifest_stop',
    sourceId: route.stopTwoId,
    subjectType: 'stop',
    subjectId: route.stopTwoId,
    routeId: route.manifestId,
    idempotencyKey: `delivery-exception-${runId}`,
    payload: { reason: 'customer_closed', severity: 'medium', settlementId: stopTwoResult.settlement.settlement.id }
  });
  await logistics.ingestEvent(orgAdmin, {
    eventType: 'kpi_snapshot_created',
    eventCategory: 'bi_kpi',
    sourceType: 'kpi_snapshot',
    sourceId: kpiSnapshot.id,
    subjectType: 'route',
    subjectId: route.manifestId,
    routeId: route.manifestId,
    idempotencyKey: `kpi-${kpiSnapshot.id}`,
    payload: { thresholdStatus: kpiSnapshot.thresholdStatus, calculatedValue: kpiSnapshot.calculatedValue }
  });
  const processed = await logistics.processIntelligence(supervisor, { limit: 25 });
  assert(processed.signals.length >= 1, 'Logistics Intelligence should process integrated events');
  assert(processed.findings.length >= 1, 'Logistics Intelligence should create explainable findings');
  assert(processed.recommendations.length >= 1, 'Logistics Intelligence should create advisory recommendations');
  const recommendations = await logistics.listRecommendations(supervisor, { limit: 25 });
  assert(recommendations.length >= 1, 'Logistics Intelligence should produce advisory recommendations');
  const recommendation = recommendations[0];
  await logistics.decideRecommendation(supervisor, recommendation.id, { decision: 'deferred', rationale: 'pilot validation' });
  const outcome = await logistics.recordOutcome(supervisor, recommendation.id, { outcomeStatus: 'measured', measuredImpact: { pilot: true } });
  assert(outcome?.id, 'Logistics Intelligence outcome should record without mutating operations');

  const scoreModel = await fiss.createScoreModel(orgAdmin, {
    scoreKey: `pilot_route_score_${runId}`,
    name: 'Pilot Route Score',
    subjectType: 'route',
    status: 'active'
  });
  const scoreVersion = await fiss.createModelVersion(orgAdmin, scoreModel.id, {
    status: 'active',
    effectiveFrom,
    componentWeights: { safety: 0.25, efficiency: 0.2, reliability: 0.2, risk: 0.15, compliance: 0.1, performance: 0.1 }
  });
  const score = await fiss.calculateScore(supervisor, scoreModel.id, {
    subjectType: 'route',
    subjectId: route.manifestId,
    periodStart: effectiveFrom,
    periodEnd: new Date().toISOString(),
    calculationRunKey: `pilot-score-${runId}`
  });
  assert(score.scoreModelVersionId === scoreVersion.id, 'FISS score should lock model version');
  assert(score.lineage?.logisticsIntelligence?.signalIds?.length >= 1, 'FISS score should preserve Logistics Intelligence lineage');
  let orgBScoreBlocked = false;
  try {
    await fiss.getScoreSnapshot(orgBAdmin, score.id);
  } catch (error) {
    orgBScoreBlocked = error.status === 404;
  }
  assert(orgBScoreBlocked, 'FISS score must be Organization-private');

  const shared = await sharedSafety.createPrivateHazardSubmission({
    category: 'low_bridge',
    latitude: 29.4241,
    longitude: -98.4936,
    description: 'Private driver route account detail that must be sanitized',
    severity: 'high',
    mayBenefitOthers: true,
    companyDriverNumber: driverNumber,
    privateContext: { routeNumber: route.routeNumber, accountNumber: `ACCT-${runId}-1` }
  }, driverContext);
  assert(shared.candidate?.id, 'driver hazard should create moderation candidate when nominated');
  const sanitized = await sharedSafety.sanitizeCandidate(shared.candidate.id, platformAdmin, {
    sanitizedDescription: 'Verified low clearance risk for commercial vehicles.',
    sanitizedLatitude: 29.4241,
    sanitizedLongitude: -98.4936,
    proposedSharedType: 'low_bridge',
    reviewNotes: 'pilot validation'
  });
  assert(sanitized.sanitizationStatus === 'sanitized', 'candidate should sanitize');
  const approved = await sharedSafety.approveCandidate(shared.candidate.id, platformAdmin, {
    sanitizedDescription: 'Verified low clearance risk for commercial vehicles.',
    sanitizedLatitude: 29.4241,
    sanitizedLongitude: -98.4936,
    hazardType: 'low_bridge',
    confidence: 'high',
    evidenceLevel: 'field_report'
  });
  assert(approved.id && approved.status === 'active', 'approved candidate should publish shared record');
  const sharedRecords = await sharedSafety.listSharedRecords({ hazardType: 'low_bridge', limit: 25 });
  const sharedRecord = sharedRecords.find((record) => record.id === approved.id);
  assert(sharedRecord, 'approved sanitized record should be visible through shared read');
  assert(!JSON.stringify(sharedRecord).includes(route.routeNumber), 'shared read must not expose private route number');

  await repositories.saveRouteSession({
    id: `route-session-${runId}`,
    originLabel: 'Demo Distribution Center',
    destinationLabel: 'Demo Account One',
    origin: { latitude: 29.4, longitude: -98.5 },
    destination: { latitude: 29.42, longitude: -98.49 },
    request: { source: 'pilot_integration_validator' }
  });
  await repositories.addRouteSessionEvent({
    routeSessionId: `route-session-${runId}`,
    eventType: 'driver_route_progress',
    severity: 'info',
    latitude: 29.42,
    longitude: -98.49,
    payload: { manifestId: route.manifestId, stopId: route.stopOneId }
  });
  const routeEvents = await repositories.listRouteSessionEvents(`route-session-${runId}`, { limit: 10 });
  assert(routeEvents.length === 1, 'route event should persist for supervisor replay/audit visibility');

  console.log(JSON.stringify({
    ok: true,
    runId,
    organization: orgA,
    routeManifestId: route.manifestId,
    routeStatus: closedRoute.status,
    departurePrinted: Boolean(printedDeparture.printed_at),
    closeoutPrinted: Boolean(printedCloseout.printedAt),
    kpiSnapshotId: kpiSnapshot.id,
    logisticsRecommendationId: recommendation.id,
    fissSnapshotId: score.id,
    sharedRecordId: sharedRecord.id,
    routeEventCount: routeEvents.length
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
