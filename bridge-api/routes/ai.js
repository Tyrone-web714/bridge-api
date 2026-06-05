const express = require('express');
const adminAuth = require('../services/adminAuth');
const driverAuth = require('../services/driverAuth');
const aiProvider = require('../services/aiProvider');
const repositories = require('../db/repositories');

const router = express.Router();

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function getRequester(req) {
  const adminSession = adminAuth.getAdminSession(req);
  if (adminSession) {
    return {
      type: 'admin',
      id: adminSession.username,
      role: adminSession.role || 'supervisor'
    };
  }

  const driverIdentity = driverAuth.getDriverIdentity(req);
  return {
    type: 'driver',
    id: driverIdentity.driverId,
    role: 'driver',
    deviceId: driverIdentity.deviceId || null
  };
}

function requireAiAccess(req, res, next) {
  if (adminAuth.getAdminSession(req)) return next();
  return driverAuth.requireDriverAuth(req, res, next);
}

function requireAdminAiAccess(req, res, next) {
  if (adminAuth.getAdminSession(req)) return next();
  return res.status(401).json({
    ok: false,
    error: 'Supervisor admin login required.'
  });
}

function requireAiConfigured(req, res, next) {
  if (aiProvider.isConfigured()) return next();
  return res.status(503).json({
    ok: false,
    error: 'AI provider is not configured. Set OPENAI_API_KEY on the backend.'
  });
}

function buildAccountSummaryPrompt() {
  return [
    'You are the AI account intelligence analyst for Truck-Safe Routing.',
    'Use only the source-of-truth data provided by the backend.',
    'Do not invent product history, account facts, prices, addresses, or operational issues.',
    'Money totals are already calculated by the backend; do not recalculate them differently.',
    'Return concise, supervisor-useful and driver-useful analysis.',
    'If data is thin or missing, say what is missing.',
    'AI recommends only. Backend rules, database records, and driver/supervisor decisions remain the source of truth.'
  ].join('\n');
}

function buildSupervisorQuestionPrompt() {
  return [
    'You are the supervisor AI analyst for Truck-Safe Routing.',
    'Answer only from the source-of-truth operational data supplied by the backend.',
    'Do not invent customer facts, product history, route problems, prices, or driver behavior.',
    'If the available data cannot answer the question, say exactly what data is missing.',
    'Separate facts from recommendations.',
    'Use concise supervisor-ready language.',
    'AI recommends only. Backend rules, database records, and supervisor decisions remain the source of truth.'
  ].join('\n');
}

function buildSupervisorBriefPrompt() {
  return [
    'You are generating a supervisor morning logistics brief for Truck-Safe Routing.',
    'Use only the route, stop, account, order, deduction, and undelivered-stop data supplied by the backend.',
    'Identify route risk, delivery risk, account/product signals, and actions supervisors should consider.',
    'Do not invent weather, traffic, customer behavior, or missing operational records.',
    'If data is thin, state that clearly.',
    'Keep the brief practical and operational.'
  ].join('\n');
}

function buildAccountForecastPrompt() {
  return [
    'You are the AI account forecasting analyst for Truck-Safe Routing.',
    'Use only the source-of-truth account, route, order, deduction, and product data supplied by the backend.',
    'Forecast conservatively. Do not invent missing purchase history, customer promises, pricing, weather, events, or inventory levels.',
    'Explain what is known, what is likely, and what data is missing.',
    'Money totals are already calculated by the backend; do not recalculate them differently.',
    'AI recommends only. Backend rules, database records, and supervisor decisions remain the source of truth.'
  ].join('\n');
}

function buildRedeliveryPlanPrompt() {
  return [
    'You are the AI redelivery recovery planner for Truck-Safe Routing.',
    'Use only the undelivered stop, route, account, product, and order data supplied by the backend.',
    'Group missed deliveries into practical supervisor actions: redeliver, call customer, cancel review, or route planning review.',
    'Do not invent customer promises, driver behavior, inventory, weather, traffic, or account facts.',
    'If the backend does not provide enough context, list the missing data instead of guessing.',
    'AI recommends only. Supervisors make final redelivery and cancellation decisions.'
  ].join('\n');
}

function buildRouteRiskExplanationPrompt() {
  return [
    'You are the AI route-risk analyst for Truck-Safe Routing.',
    'Use only the saved route session, chosen route, truck profile, route options, and hazard data supplied by the backend.',
    'Explain why the selected truck route is safe, risky, or requires supervisor attention.',
    'Compare the chosen route against available alternatives only when route option summaries are present.',
    'Do not invent roads, hazards, traffic, bridge clearances, restrictions, or route details.',
    'Separate verified facts from recommendations.',
    'AI explains and recommends only. Backend hazard rules, route scoring, and supervisor decisions remain the source of truth.'
  ].join('\n');
}

function buildDriverCopilotPrompt() {
  return [
    'You are the driver AI copilot for Truck-Safe Routing.',
    'Answer only from the assigned route, selected stop, account order history, account insights, and delivery context supplied by the backend.',
    'Keep responses short, direct, and useful while the driver is working.',
    'Do not invent parking instructions, delivery rules, product facts, customer preferences, road permissions, or hazards.',
    'If the driver asks whether a road is legal or safe and the provided context does not answer it, say that the app must rely on verified route/hazard data.',
    'Do not tell the driver to violate company policy, road restrictions, truck restrictions, or safety rules.',
    'AI recommends only. Backend rules, verified hazards, route guidance, and driver judgment remain the source of truth.'
  ].join('\n');
}

function buildDeliveryNotesSummaryPrompt() {
  return [
    'You are the AI delivery-knowledge analyst for Truck-Safe Routing.',
    'Use only the driver delivery notes, account context, route context, and photo metadata supplied by the backend.',
    'Summarize practical account guidance for future drivers and supervisors.',
    'Do not invent customer rules, dock instructions, access codes, parking locations, phone numbers, photo contents, or delivery risks.',
    'If photos are present but no captions or text descriptions are provided, say only that photos are available; do not describe what is in them.',
    'Deduplicate repeated driver comments and separate reliable guidance from missing data.',
    'AI summarizes and recommends only. Driver notes, uploaded photos, and supervisor verification remain the source of truth.'
  ].join('\n');
}

function normalizeRouteDate(value) {
  const raw = cleanText(value, 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 10);
}

async function ensureDriverCanAccessAccount(requester, accountNumber, routeDate) {
  if (requester.type !== 'driver') return null;

  const route = await repositories.getAssignedDailyRouteForDriver(requester.id, routeDate);
  const stops = Array.isArray(route?.stops) ? route.stops : [];
  const stop = stops.find((candidate) => String(candidate.accountNumber || '') === String(accountNumber || ''));
  if (!stop) {
    const error = new Error('Driver is not assigned to this account for the selected route date.');
    error.status = 403;
    throw error;
  }
  return {
    routeManifestId: route.id,
    routeStopId: stop.id,
    stopSequence: stop.stopSequence
  };
}

const accountSummarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    accountHealth: { type: 'string', enum: ['unknown', 'stable', 'watch', 'risk', 'growth_opportunity'] },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    keyFindings: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    spendingSignals: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5
    },
    deductionSignals: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5
    },
    missingData: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    }
  },
  required: [
    'title',
    'summary',
    'accountHealth',
    'confidence',
    'keyFindings',
    'spendingSignals',
    'deductionSignals',
    'recommendedActions',
    'missingData'
  ]
};

const supervisorQuestionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    answer: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    factsUsed: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    missingData: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    followUpQuestions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4
    }
  },
  required: [
    'title',
    'answer',
    'confidence',
    'factsUsed',
    'recommendations',
    'missingData',
    'followUpQuestions'
  ]
};

const supervisorBriefSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    routeRisks: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    accountRisks: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    productSignals: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    missingData: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    }
  },
  required: [
    'title',
    'summary',
    'routeRisks',
    'accountRisks',
    'productSignals',
    'recommendedActions',
    'missingData'
  ]
};

const accountForecastSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    forecastConfidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reorderLikelihood: { type: 'string', enum: ['unknown', 'low', 'medium', 'high'] },
    accountRisk: { type: 'string', enum: ['unknown', 'low', 'medium', 'high'] },
    productOpportunities: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    reorderSignals: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    deductionRisks: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    deliveryRisks: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    missingData: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    }
  },
  required: [
    'title',
    'summary',
    'forecastConfidence',
    'reorderLikelihood',
    'accountRisk',
    'productOpportunities',
    'reorderSignals',
    'deductionRisks',
    'deliveryRisks',
    'recommendedActions',
    'missingData'
  ]
};

const redeliveryPlanSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    redeliveryCandidates: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    customerContactNeeded: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    cancelReviewCandidates: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    routePlanningIssues: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    missingData: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    }
  },
  required: [
    'title',
    'summary',
    'redeliveryCandidates',
    'customerContactNeeded',
    'cancelReviewCandidates',
    'routePlanningIssues',
    'recommendedActions',
    'missingData'
  ]
};

const routeRiskExplanationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    safetyRating: { type: 'string', enum: ['unknown', 'low', 'medium', 'high', 'critical'] },
    safeRouteReasons: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    primaryRisks: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    hazardConcerns: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    truckProfileConcerns: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    routeComparison: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    },
    missingData: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    }
  },
  required: [
    'title',
    'summary',
    'safetyRating',
    'safeRouteReasons',
    'primaryRisks',
    'hazardConcerns',
    'truckProfileConcerns',
    'routeComparison',
    'recommendedActions',
    'missingData'
  ]
};

const driverCopilotSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    answer: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    factsUsed: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    driverActions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5
    },
    safetyNotes: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5
    },
    missingData: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    }
  },
  required: [
    'title',
    'answer',
    'confidence',
    'factsUsed',
    'driverActions',
    'safetyNotes',
    'missingData'
  ]
};

const deliveryNotesSummarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    accountGuidance: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    accessInstructions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    deliveryRisks: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    usefulDriverTips: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    photoSignals: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5
    },
    recommendedActions: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 6
    },
    missingData: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 8
    }
  },
  required: [
    'title',
    'summary',
    'confidence',
    'accountGuidance',
    'accessInstructions',
    'deliveryRisks',
    'usefulDriverTips',
    'photoSignals',
    'recommendedActions',
    'missingData'
  ]
};

function compactAccountSummaryForAi(summary) {
  return {
    accountNumber: summary.accountNumber,
    accountName: summary.accountName,
    periodDays: summary.periodDays,
    orderCount: summary.orderCount,
    subtotalAmount: summary.subtotalAmount,
    deductionAmount: summary.deductionAmount,
    netAmount: summary.netAmount,
    firstOrderDate: summary.firstOrderDate,
    lastOrderDate: summary.lastOrderDate,
    topProducts: (summary.topProducts || []).slice(0, 10).map((product) => ({
      sku: product.sku,
      productName: product.productName,
      brand: product.brand,
      category: product.category,
      quantity: product.quantity,
      grossAmount: product.grossAmount,
      deductionAmount: product.deductionAmount,
      netAmount: product.netAmount
    })),
    deductionReasons: (summary.deductionReasons || []).slice(0, 10),
    recentOrders: (summary.recentOrders || []).slice(0, 5).map((order) => ({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
      subtotalAmount: order.subtotalAmount,
      deductionAmount: order.deductionAmount,
      netAmount: order.netAmount,
      status: order.status,
      itemCount: Array.isArray(order.items) ? order.items.length : 0
    })),
    recentRouteStops: (summary.recentRouteStops || []).slice(0, 5).map((stop) => ({
      routeDate: stop.routeDate,
      routeNumber: stop.routeNumber,
      routeName: stop.routeName,
      stopSequence: stop.stopSequence,
      accountName: stop.accountName,
      destinationAddress: stop.destinationAddress,
      caseCount: stop.caseCount,
      palletCount: stop.palletCount,
      status: stop.status,
      assignedDriverId: stop.assignedDriverId
    }))
  };
}

function normalizeSearchValue(value) {
  return String(value || '').trim().toLowerCase();
}

function compactDeliveryNoteForAi(note) {
  return {
    id: note.id,
    destination: note.destination || null,
    address: note.address || null,
    accountName: note.accountName || null,
    customerName: note.customerName || null,
    instructions: note.instructions || '',
    driverName: note.driverName || null,
    routeContext: note.routeContext || null,
    photoCount: Array.isArray(note.photos) ? note.photos.length : 0,
    photos: (note.photos || []).slice(0, 8).map((photo) => ({
      originalName: photo.originalName || null,
      mimeType: photo.mimeType || null,
      uploadedAt: photo.uploadedAt || null
    })),
    createdAt: note.createdAt || null,
    updatedAt: note.updatedAt || null
  };
}

function deliveryNoteMatchesContext(note, context) {
  const fields = [
    note.destination,
    note.address,
    note.accountName,
    note.customerName,
    note.routeContext
  ].map(normalizeSearchValue).filter(Boolean);

  const terms = [
    context.destination,
    context.address,
    context.accountName
  ].map(normalizeSearchValue).filter(Boolean);

  if (!terms.length) return true;
  return terms.some((term) => fields.some((field) => field.includes(term) || term.includes(field)));
}

async function buildDeliveryNotesContext({ accountNumber, destination, routeDate }) {
  const context = {
    accountNumber: accountNumber || null,
    destination: destination || null,
    routeDate: routeDate || null,
    accountSummary: null,
    matchingRouteStops: [],
    notes: []
  };

  if (accountNumber) {
    const summary = await repositories.getAccountProductSummary(accountNumber, { periodDays: 365 });
    context.accountSummary = compactAccountSummaryForAi(summary);
    context.matchingRouteStops = (summary.recentRouteStops || []).slice(0, 5).map((stop) => ({
      routeDate: stop.routeDate,
      routeNumber: stop.routeNumber,
      stopSequence: stop.stopSequence,
      accountName: stop.accountName,
      destinationAddress: stop.destinationAddress,
      status: stop.status,
      assignedDriverId: stop.assignedDriverId,
      assignedDriverName: stop.assignedDriverName
    }));
  }

  const searchContext = {
    destination: destination || context.matchingRouteStops[0]?.destinationAddress || '',
    address: context.matchingRouteStops[0]?.destinationAddress || '',
    accountName: context.accountSummary?.accountName || ''
  };
  const notes = await repositories.listDeliveryNotes();
  context.notes = notes
    .filter((note) => deliveryNoteMatchesContext(note, searchContext))
    .slice(0, 25)
    .map(compactDeliveryNoteForAi);

  return context;
}

function compactHazardsForAi(hazards = {}) {
  return {
    lowBridges: (hazards.lowBridges || []).slice(0, 10).map((hazard) => ({
      name: hazard.name || hazard.bridge_name || null,
      clearanceFt: hazard.clearance_ft ?? hazard.clearanceFt ?? null,
      latitude: hazard.latitude ?? hazard.lat ?? null,
      longitude: hazard.longitude ?? hazard.lng ?? null,
      distanceM: hazard.distance_m ?? hazard.distanceM ?? null,
      source: hazard.source || hazard.dataSource || null,
      verificationStatus: hazard.verification_status || hazard.verificationStatus || null
    })),
    noTruckZones: (hazards.noTruckZones || []).slice(0, 10).map((hazard) => ({
      name: hazard.name || null,
      restriction: hazard.restriction || null,
      distanceM: hazard.distance_m ?? hazard.distanceM ?? null,
      source: hazard.source || hazard.dataSource || null,
      verificationStatus: hazard.verification_status || hazard.verificationStatus || null
    })),
    residentialZones: (hazards.residentialZones || []).slice(0, 10).map((hazard) => ({
      name: hazard.name || null,
      restriction: hazard.restriction || null,
      distanceM: hazard.distance_m ?? hazard.distanceM ?? null,
      source: hazard.source || hazard.dataSource || null,
      verificationStatus: hazard.verification_status || hazard.verificationStatus || null
    }))
  };
}

function compactRouteSessionForAi(session) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    originLabel: session.originLabel,
    destinationLabel: session.destinationLabel,
    chosenRouteIndex: session.chosenRouteIndex,
    routeCount: session.routeCount,
    hazardSummary: session.hazardSummary || {},
    chosenRouteHazards: compactHazardsForAi(session.chosenRouteHazards || {}),
    usedTruckProfile: session.usedTruckProfile || {},
    usedTuning: session.usedTuning || {},
    routeOptions: (session.routeOptions || []).slice(0, 5).map((route) => ({
      index: route.index,
      summary: route.summary || '',
      distanceM: route.distance_m ?? route.distanceM ?? null,
      durationS: route.duration_s ?? route.durationS ?? null,
      score: route.score ?? null,
      hazardSummary: route.hazardSummary || {},
      stepCount: route.stepCount ?? null
    })),
    reviewStatus: session.reviewStatus,
    supervisorNotes: session.supervisorNotes || null
  };
}

function isFinishedStop(stop) {
  return ['completed', 'departed', 'skipped', 'undelivered'].includes(String(stop?.status || '').toLowerCase());
}

function compactStopForDriverCopilot(stop) {
  if (!stop) return null;
  return {
    id: stop.id,
    stopSequence: stop.stopSequence,
    accountNumber: stop.accountNumber,
    accountName: stop.accountName,
    destinationAddress: stop.destinationAddress,
    city: stop.city,
    stateCode: stop.stateCode,
    postalCode: stop.postalCode,
    plannedArrivalAt: stop.plannedArrivalAt,
    plannedDepartureAt: stop.plannedDepartureAt,
    plannedServiceMinutes: stop.plannedServiceMinutes,
    driveMinutesToNext: stop.driveMinutesToNext,
    palletCount: stop.palletCount,
    caseCount: stop.caseCount,
    itemSummary: (stop.itemSummary || []).slice(0, 20),
    status: stop.status,
    nonDeliveryReason: stop.nonDeliveryReason,
    accountProductTotals: stop.accountProductTotals || null,
    accountInsights: (stop.accountInsights || []).slice(0, 5).map((insight) => ({
      title: insight.title,
      summary: insight.summary,
      confidence: insight.confidence,
      insightType: insight.insightType
    })),
    accountOrders: (stop.accountOrders || []).slice(0, 3).map((order) => ({
      invoiceNumber: order.invoiceNumber,
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
      subtotalAmount: order.subtotalAmount,
      deductionAmount: order.deductionAmount,
      netAmount: order.netAmount,
      status: order.status,
      items: (order.items || []).slice(0, 12).map((item) => ({
        sku: item.sku,
        productName: item.productName,
        brand: item.brand,
        category: item.category,
        quantity: item.quantity,
        netAmount: item.netAmount
      })),
      deductions: (order.deductions || []).slice(0, 5).map((deduction) => ({
        reason: deduction.reason,
        amount: deduction.amount,
        notes: deduction.notes
      }))
    }))
  };
}

function compactAssignedRouteForDriverCopilot(route, currentStopId) {
  const stops = Array.isArray(route?.stops) ? route.stops : [];
  const selectedStop = currentStopId
    ? stops.find((stop) => String(stop.id) === String(currentStopId))
    : stops.find((stop) => !isFinishedStop(stop)) || stops[0] || null;

  return {
    id: route.id,
    routeDate: route.routeDate,
    routeNumber: route.routeNumber,
    routeName: route.routeName,
    startLocation: route.startLocation,
    plannedStartAt: route.plannedStartAt,
    plannedEndAt: route.plannedEndAt,
    totalStops: route.totalStops,
    totalPallets: route.totalPallets,
    totalCases: route.totalCases,
    assignedDriverId: route.assignedDriverId,
    assignedDriverName: route.assignedDriverName,
    status: route.status,
    completedStops: stops.filter(isFinishedStop).length,
    selectedStop: compactStopForDriverCopilot(selectedStop),
    upcomingStops: stops
      .filter((stop) => !isFinishedStop(stop))
      .slice(0, 5)
      .map((stop) => ({
        id: stop.id,
        stopSequence: stop.stopSequence,
        accountNumber: stop.accountNumber,
        accountName: stop.accountName,
        destinationAddress: stop.destinationAddress,
        plannedArrivalAt: stop.plannedArrivalAt,
        plannedServiceMinutes: stop.plannedServiceMinutes,
        palletCount: stop.palletCount,
        caseCount: stop.caseCount,
        status: stop.status
      }))
  };
}

async function buildSupervisorContext({ accountNumber, routeDate, periodDays }) {
  const context = {
    routeDate: routeDate || null,
    periodDays,
    account: null,
    accountInsights: [],
    recentRoutes: [],
    undeliveredStops: [],
    recentOrders: []
  };

  if (accountNumber) {
    const summary = await repositories.getAccountProductSummary(accountNumber, { periodDays });
    context.account = compactAccountSummaryForAi(summary);
    context.accountInsights = (await repositories.listAccountInsights({
      accountNumber,
      limit: 5
    })).map((insight) => ({
      title: insight.title,
      summary: insight.summary,
      confidence: insight.confidence,
      insightType: insight.insightType,
      createdAt: insight.createdAt
    }));
  }

  context.recentRoutes = (await repositories.listDailyRouteManifests({
    routeDate,
    limit: 20
  })).map((route) => ({
    id: route.id,
    routeDate: route.routeDate,
    routeNumber: route.routeNumber,
    routeName: route.routeName,
    totalStops: route.totalStops,
    totalPallets: route.totalPallets,
    totalCases: route.totalCases,
    assignedDriverId: route.assignedDriverId,
    assignedDriverName: route.assignedDriverName,
    status: route.status,
    plannedStartAt: route.plannedStartAt,
    plannedEndAt: route.plannedEndAt
  }));

  context.undeliveredStops = (await repositories.listUndeliveredRouteStops({
    routeDate,
    limit: 25
  })).map((stop) => ({
    routeDate: stop.routeDate,
    routeNumber: stop.routeNumber,
    stopSequence: stop.stopSequence,
    accountNumber: stop.accountNumber,
    accountName: stop.accountName,
    destinationAddress: stop.destinationAddress,
    assignedDriverId: stop.assignedDriverId,
    assignedDriverName: stop.assignedDriverName,
    nonDeliveryReason: stop.nonDeliveryReason,
    redeliveryStatus: stop.redeliveryStatus,
    redeliveryDate: stop.redeliveryDate
  }));

  context.recentOrders = (await repositories.listAccountOrders({
    accountNumber: accountNumber || undefined,
    limit: accountNumber ? 10 : 25
  })).map((order) => ({
    accountNumber: order.accountNumber,
    accountName: order.accountName,
    invoiceNumber: order.invoiceNumber,
    orderDate: order.orderDate,
    deliveryDate: order.deliveryDate,
    subtotalAmount: order.subtotalAmount,
    deductionAmount: order.deductionAmount,
    netAmount: order.netAmount,
    status: order.status,
    itemCount: Array.isArray(order.items) ? order.items.length : 0
  }));

  return context;
}

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    ai: aiProvider.getStatus()
  });
});

router.post('/account-summary', requireAiAccess, requireAiConfigured, async (req, res) => {
  const startedAt = Date.now();
  const requester = getRequester(req);
  const accountNumber = cleanText(req.body?.accountNumber || req.body?.account_number, 120);
  const periodDays = Number.parseInt(req.body?.periodDays || req.body?.period_days, 10) || 180;
  const routeDate = normalizeRouteDate(req.body?.routeDate || req.body?.route_date);

  if (!accountNumber) {
    return res.status(400).json({
      ok: false,
      error: 'accountNumber is required.'
    });
  }

  let aiResult = null;
  try {
    const driverRouteContext = await ensureDriverCanAccessAccount(requester, accountNumber, routeDate);
    const sourceSummary = await repositories.getAccountProductSummary(accountNumber, { periodDays });
    const aiInput = compactAccountSummaryForAi(sourceSummary);
    aiResult = await aiProvider.createStructuredResponse({
      endpoint: 'account-summary',
      instructions: buildAccountSummaryPrompt(),
      input: aiInput,
      schemaName: 'truck_safe_account_summary',
      schema: accountSummarySchema
    });

    const savedInsight = await repositories.saveAccountInsight({
      accountNumber,
      insightType: 'openai_account_summary',
      title: aiResult.parsed.title,
      summary: aiResult.parsed.summary,
      confidence: aiResult.parsed.confidence,
      sourcePeriodStart: sourceSummary.firstOrderDate || null,
      sourcePeriodEnd: sourceSummary.lastOrderDate || null,
      generatedBy: `openai:${aiResult.model}`,
      raw: {
        accountHealth: aiResult.parsed.accountHealth,
        keyFindings: aiResult.parsed.keyFindings,
        spendingSignals: aiResult.parsed.spendingSignals,
        deductionSignals: aiResult.parsed.deductionSignals,
        recommendedActions: aiResult.parsed.recommendedActions,
        missingData: aiResult.parsed.missingData,
        sourceSummary: {
          periodDays: sourceSummary.periodDays,
          orderCount: sourceSummary.orderCount,
          recentRouteStopCount: Array.isArray(sourceSummary.recentRouteStops) ? sourceSummary.recentRouteStops.length : 0,
          subtotalAmount: sourceSummary.subtotalAmount,
          deductionAmount: sourceSummary.deductionAmount,
          netAmount: sourceSummary.netAmount
        }
      }
    });

    await repositories.saveAiInteractionLog({
      endpoint: 'account-summary',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber,
      routeManifestId: driverRouteContext?.routeManifestId || null,
      routeStopId: driverRouteContext?.routeStopId || null,
      model: aiResult.model,
      status: 'success',
      inputSummary: {
        accountNumber,
        routeDate: requester.type === 'driver' ? routeDate : null,
        periodDays,
        orderCount: sourceSummary.orderCount,
        recentRouteStopCount: Array.isArray(sourceSummary.recentRouteStops) ? sourceSummary.recentRouteStops.length : 0,
        topProductCount: sourceSummary.topProducts.length,
        deductionReasonCount: sourceSummary.deductionReasons.length
      },
      outputSummary: aiResult.parsed,
      latencyMs: Date.now() - startedAt
    });

    return res.json({
      ok: true,
      requester,
      accountNumber,
      routeDate: requester.type === 'driver' ? routeDate : null,
      routeContext: driverRouteContext,
      sourceSummary,
      ai: {
        provider: 'openai',
        model: aiResult.model,
        store: false,
        savedInsight,
        ...aiResult.parsed
      }
    });
  } catch (error) {
    await repositories.saveAiInteractionLog({
      endpoint: 'account-summary',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber,
      model: aiResult?.model || aiProvider.getModel(),
      status: 'error',
      inputSummary: { accountNumber, periodDays },
      outputSummary: {},
      errorMessage: error.message,
      latencyMs: Date.now() - startedAt
    }).catch(() => {});

    return res.status(error.status || 500).json({
      ok: false,
      error: error.status ? error.message : 'AI account summary failed.'
    });
  }
});

router.post('/driver-copilot', requireAiAccess, requireAiConfigured, async (req, res) => {
  const startedAt = Date.now();
  const requester = getRequester(req);
  const question = cleanText(req.body?.question, 1500);
  const routeDate = normalizeRouteDate(req.body?.routeDate || req.body?.route_date);
  const currentStopId = cleanText(req.body?.currentStopId || req.body?.current_stop_id, 160);
  const driverId = requester.type === 'admin'
    ? cleanText(req.body?.driverId || req.body?.driver_id, 160)
    : requester.id;
  let aiResult = null;
  let routeContext = null;

  if (!question) {
    return res.status(400).json({
      ok: false,
      error: 'question is required.'
    });
  }

  if (!driverId) {
    return res.status(400).json({
      ok: false,
      error: 'driverId is required.'
    });
  }

  try {
    const route = await repositories.getAssignedDailyRouteForDriver(driverId, routeDate);
    if (!route) {
      return res.status(404).json({
        ok: false,
        error: 'No assigned route found for this driver and route date.'
      });
    }

    routeContext = compactAssignedRouteForDriverCopilot(route, currentStopId);
    aiResult = await aiProvider.createStructuredResponse({
      endpoint: 'driver-copilot',
      instructions: buildDriverCopilotPrompt(),
      input: {
        question,
        routeContext
      },
      schemaName: 'truck_safe_driver_copilot',
      schema: driverCopilotSchema
    });

    await repositories.saveAiInteractionLog({
      endpoint: 'driver-copilot',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: routeContext.selectedStop?.accountNumber || null,
      routeManifestId: route.id,
      routeStopId: routeContext.selectedStop?.id || null,
      model: aiResult.model,
      status: 'success',
      inputSummary: {
        question,
        routeDate,
        driverId,
        routeManifestId: route.id,
        currentStopId: routeContext.selectedStop?.id || null,
        accountNumber: routeContext.selectedStop?.accountNumber || null
      },
      outputSummary: aiResult.parsed,
      latencyMs: Date.now() - startedAt
    });

    return res.json({
      ok: true,
      requester,
      driverId,
      routeDate,
      routeContext,
      ai: {
        provider: 'openai',
        model: aiResult.model,
        store: false,
        ...aiResult.parsed
      }
    });
  } catch (error) {
    await repositories.saveAiInteractionLog({
      endpoint: 'driver-copilot',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: routeContext?.selectedStop?.accountNumber || null,
      routeManifestId: routeContext?.id || null,
      routeStopId: routeContext?.selectedStop?.id || null,
      model: aiResult?.model || aiProvider.getModel(),
      status: 'error',
      inputSummary: { question, routeDate, driverId, currentStopId },
      outputSummary: {},
      errorMessage: error.message,
      latencyMs: Date.now() - startedAt
    }).catch(() => {});

    return res.status(error.status || 500).json({
      ok: false,
      error: error.status ? error.message : 'AI driver copilot failed.'
    });
  }
});

router.post('/delivery-notes-summary', requireAdminAiAccess, requireAiConfigured, async (req, res) => {
  const startedAt = Date.now();
  const requester = getRequester(req);
  const accountNumber = cleanText(req.body?.accountNumber || req.body?.account_number, 120);
  const destination = cleanText(req.body?.destination, 240);
  const routeDate = normalizeRouteDate(req.body?.routeDate || req.body?.route_date);
  let aiResult = null;

  if (!accountNumber && !destination) {
    return res.status(400).json({
      ok: false,
      error: 'accountNumber or destination is required.'
    });
  }

  try {
    const sourceContext = await buildDeliveryNotesContext({ accountNumber, destination, routeDate });
    aiResult = await aiProvider.createStructuredResponse({
      endpoint: 'delivery-notes-summary',
      instructions: buildDeliveryNotesSummaryPrompt(),
      input: sourceContext,
      schemaName: 'truck_safe_delivery_notes_summary',
      schema: deliveryNotesSummarySchema
    });

    if (accountNumber) {
      await repositories.saveAccountInsight({
        accountNumber,
        insightType: 'openai_delivery_notes_summary',
        title: aiResult.parsed.title,
        summary: aiResult.parsed.summary,
        confidence: aiResult.parsed.confidence,
        sourcePeriodStart: null,
        sourcePeriodEnd: null,
        generatedBy: `openai:${aiResult.model}`,
        raw: {
          accountGuidance: aiResult.parsed.accountGuidance,
          accessInstructions: aiResult.parsed.accessInstructions,
          deliveryRisks: aiResult.parsed.deliveryRisks,
          usefulDriverTips: aiResult.parsed.usefulDriverTips,
          photoSignals: aiResult.parsed.photoSignals,
          recommendedActions: aiResult.parsed.recommendedActions,
          missingData: aiResult.parsed.missingData,
          noteCount: sourceContext.notes.length
        }
      });
    }

    await repositories.saveAiInteractionLog({
      endpoint: 'delivery-notes-summary',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: accountNumber || null,
      model: aiResult.model,
      status: 'success',
      inputSummary: {
        accountNumber: accountNumber || null,
        destination: destination || null,
        routeDate,
        noteCount: sourceContext.notes.length,
        matchingRouteStopCount: sourceContext.matchingRouteStops.length
      },
      outputSummary: aiResult.parsed,
      latencyMs: Date.now() - startedAt
    });

    return res.json({
      ok: true,
      requester,
      accountNumber: accountNumber || null,
      destination: destination || null,
      routeDate,
      sourceContext,
      ai: {
        provider: 'openai',
        model: aiResult.model,
        store: false,
        ...aiResult.parsed
      }
    });
  } catch (error) {
    await repositories.saveAiInteractionLog({
      endpoint: 'delivery-notes-summary',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: accountNumber || null,
      model: aiResult?.model || aiProvider.getModel(),
      status: 'error',
      inputSummary: { accountNumber, destination, routeDate },
      outputSummary: {},
      errorMessage: error.message,
      latencyMs: Date.now() - startedAt
    }).catch(() => {});

    return res.status(error.status || 500).json({
      ok: false,
      error: error.status ? error.message : 'AI delivery notes summary failed.'
    });
  }
});

router.post('/supervisor-question', requireAdminAiAccess, requireAiConfigured, async (req, res) => {
  const startedAt = Date.now();
  const requester = getRequester(req);
  const question = cleanText(req.body?.question, 2000);
  const accountNumber = cleanText(req.body?.accountNumber || req.body?.account_number, 120);
  const periodDays = Number.parseInt(req.body?.periodDays || req.body?.period_days, 10) || 180;
  const routeDate = normalizeRouteDate(req.body?.routeDate || req.body?.route_date);
  let aiResult = null;

  if (!question) {
    return res.status(400).json({
      ok: false,
      error: 'question is required.'
    });
  }

  try {
    const sourceContext = await buildSupervisorContext({ accountNumber, routeDate, periodDays });
    aiResult = await aiProvider.createStructuredResponse({
      endpoint: 'supervisor-question',
      instructions: buildSupervisorQuestionPrompt(),
      input: {
        question,
        sourceContext
      },
      schemaName: 'truck_safe_supervisor_question',
      schema: supervisorQuestionSchema
    });

    await repositories.saveAiInteractionLog({
      endpoint: 'supervisor-question',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: accountNumber || null,
      model: aiResult.model,
      status: 'success',
      inputSummary: {
        question,
        routeDate,
        periodDays,
        accountNumber: accountNumber || null,
        routeCount: sourceContext.recentRoutes.length,
        undeliveredStopCount: sourceContext.undeliveredStops.length,
        orderCount: sourceContext.recentOrders.length
      },
      outputSummary: aiResult.parsed,
      latencyMs: Date.now() - startedAt
    });

    return res.json({
      ok: true,
      requester,
      question,
      accountNumber: accountNumber || null,
      routeDate,
      sourceContext,
      ai: {
        provider: 'openai',
        model: aiResult.model,
        store: false,
        ...aiResult.parsed
      }
    });
  } catch (error) {
    await repositories.saveAiInteractionLog({
      endpoint: 'supervisor-question',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: accountNumber || null,
      model: aiResult?.model || aiProvider.getModel(),
      status: 'error',
      inputSummary: { question, accountNumber, routeDate, periodDays },
      outputSummary: {},
      errorMessage: error.message,
      latencyMs: Date.now() - startedAt
    }).catch(() => {});

    return res.status(error.status || 500).json({
      ok: false,
      error: error.status ? error.message : 'AI supervisor question failed.'
    });
  }
});

router.post('/account-forecast', requireAdminAiAccess, requireAiConfigured, async (req, res) => {
  const startedAt = Date.now();
  const requester = getRequester(req);
  const accountNumber = cleanText(req.body?.accountNumber || req.body?.account_number, 120);
  const periodDays = Number.parseInt(req.body?.periodDays || req.body?.period_days, 10) || 180;
  const routeDate = normalizeRouteDate(req.body?.routeDate || req.body?.route_date);
  let aiResult = null;

  if (!accountNumber) {
    return res.status(400).json({
      ok: false,
      error: 'accountNumber is required.'
    });
  }

  try {
    const sourceContext = await buildSupervisorContext({ accountNumber, routeDate, periodDays });
    aiResult = await aiProvider.createStructuredResponse({
      endpoint: 'account-forecast',
      instructions: buildAccountForecastPrompt(),
      input: sourceContext,
      schemaName: 'truck_safe_account_forecast',
      schema: accountForecastSchema
    });

    const savedInsight = await repositories.saveAccountInsight({
      accountNumber,
      insightType: 'openai_account_forecast',
      title: aiResult.parsed.title,
      summary: aiResult.parsed.summary,
      confidence: aiResult.parsed.forecastConfidence,
      sourcePeriodStart: sourceContext.account?.firstOrderDate || null,
      sourcePeriodEnd: sourceContext.account?.lastOrderDate || null,
      generatedBy: `openai:${aiResult.model}`,
      raw: {
        reorderLikelihood: aiResult.parsed.reorderLikelihood,
        accountRisk: aiResult.parsed.accountRisk,
        productOpportunities: aiResult.parsed.productOpportunities,
        reorderSignals: aiResult.parsed.reorderSignals,
        deductionRisks: aiResult.parsed.deductionRisks,
        deliveryRisks: aiResult.parsed.deliveryRisks,
        recommendedActions: aiResult.parsed.recommendedActions,
        missingData: aiResult.parsed.missingData
      }
    });

    await repositories.saveAiInteractionLog({
      endpoint: 'account-forecast',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber,
      model: aiResult.model,
      status: 'success',
      inputSummary: {
        accountNumber,
        routeDate,
        periodDays,
        orderCount: sourceContext.account?.orderCount || 0,
        topProductCount: sourceContext.account?.topProducts?.length || 0,
        recentRouteStopCount: sourceContext.account?.recentRouteStops?.length || 0
      },
      outputSummary: aiResult.parsed,
      latencyMs: Date.now() - startedAt
    });

    return res.json({
      ok: true,
      requester,
      accountNumber,
      routeDate,
      sourceContext,
      ai: {
        provider: 'openai',
        model: aiResult.model,
        store: false,
        savedInsight,
        ...aiResult.parsed
      }
    });
  } catch (error) {
    await repositories.saveAiInteractionLog({
      endpoint: 'account-forecast',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber,
      model: aiResult?.model || aiProvider.getModel(),
      status: 'error',
      inputSummary: { accountNumber, routeDate, periodDays },
      outputSummary: {},
      errorMessage: error.message,
      latencyMs: Date.now() - startedAt
    }).catch(() => {});

    return res.status(error.status || 500).json({
      ok: false,
      error: error.status ? error.message : 'AI account forecast failed.'
    });
  }
});

router.post('/redelivery-plan', requireAdminAiAccess, requireAiConfigured, async (req, res) => {
  const startedAt = Date.now();
  const requester = getRequester(req);
  const routeDate = normalizeRouteDate(req.body?.routeDate || req.body?.route_date);
  const periodDays = Number.parseInt(req.body?.periodDays || req.body?.period_days, 10) || 180;
  let aiResult = null;

  try {
    const sourceContext = await buildSupervisorContext({ routeDate, periodDays });
    aiResult = await aiProvider.createStructuredResponse({
      endpoint: 'redelivery-plan',
      instructions: buildRedeliveryPlanPrompt(),
      input: sourceContext,
      schemaName: 'truck_safe_redelivery_plan',
      schema: redeliveryPlanSchema
    });

    await repositories.saveAiInteractionLog({
      endpoint: 'redelivery-plan',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: null,
      model: aiResult.model,
      status: 'success',
      inputSummary: {
        routeDate,
        periodDays,
        routeCount: sourceContext.recentRoutes.length,
        undeliveredStopCount: sourceContext.undeliveredStops.length,
        orderCount: sourceContext.recentOrders.length
      },
      outputSummary: aiResult.parsed,
      latencyMs: Date.now() - startedAt
    });

    return res.json({
      ok: true,
      requester,
      routeDate,
      sourceContext,
      ai: {
        provider: 'openai',
        model: aiResult.model,
        store: false,
        ...aiResult.parsed
      }
    });
  } catch (error) {
    await repositories.saveAiInteractionLog({
      endpoint: 'redelivery-plan',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: null,
      model: aiResult?.model || aiProvider.getModel(),
      status: 'error',
      inputSummary: { routeDate, periodDays },
      outputSummary: {},
      errorMessage: error.message,
      latencyMs: Date.now() - startedAt
    }).catch(() => {});

    return res.status(error.status || 500).json({
      ok: false,
      error: error.status ? error.message : 'AI redelivery plan failed.'
    });
  }
});

router.post('/route-risk-explanation', requireAdminAiAccess, requireAiConfigured, async (req, res) => {
  const startedAt = Date.now();
  const requester = getRequester(req);
  const routeSessionId = cleanText(req.body?.routeSessionId || req.body?.route_session_id, 160);
  let aiResult = null;
  let routeSession = null;

  try {
    if (routeSessionId) {
      routeSession = await repositories.getRouteSession(routeSessionId);
    } else {
      const sessions = await repositories.listRouteSessions({ limit: 1 });
      routeSession = sessions[0] || null;
    }

    if (!routeSession) {
      return res.status(404).json({
        ok: false,
        error: routeSessionId ? 'Route session not found.' : 'No saved route sessions found.'
      });
    }

    const sourceContext = {
      routeSession: compactRouteSessionForAi(routeSession)
    };

    aiResult = await aiProvider.createStructuredResponse({
      endpoint: 'route-risk-explanation',
      instructions: buildRouteRiskExplanationPrompt(),
      input: sourceContext,
      schemaName: 'truck_safe_route_risk_explanation',
      schema: routeRiskExplanationSchema
    });

    await repositories.saveAiInteractionLog({
      endpoint: 'route-risk-explanation',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: null,
      model: aiResult.model,
      status: 'success',
      inputSummary: {
        routeSessionId: routeSession.id,
        chosenRouteIndex: routeSession.chosenRouteIndex,
        routeCount: routeSession.routeCount,
        destinationLabel: routeSession.destinationLabel,
        hazardSummary: routeSession.hazardSummary || {}
      },
      outputSummary: aiResult.parsed,
      latencyMs: Date.now() - startedAt
    });

    return res.json({
      ok: true,
      requester,
      routeSessionId: routeSession.id,
      sourceContext,
      ai: {
        provider: 'openai',
        model: aiResult.model,
        store: false,
        ...aiResult.parsed
      }
    });
  } catch (error) {
    await repositories.saveAiInteractionLog({
      endpoint: 'route-risk-explanation',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: null,
      model: aiResult?.model || aiProvider.getModel(),
      status: 'error',
      inputSummary: { routeSessionId },
      outputSummary: {},
      errorMessage: error.message,
      latencyMs: Date.now() - startedAt
    }).catch(() => {});

    return res.status(error.status || 500).json({
      ok: false,
      error: error.status ? error.message : 'AI route risk explanation failed.'
    });
  }
});

router.post('/supervisor-brief', requireAdminAiAccess, requireAiConfigured, async (req, res) => {
  const startedAt = Date.now();
  const requester = getRequester(req);
  const routeDate = normalizeRouteDate(req.body?.routeDate || req.body?.route_date);
  const periodDays = Number.parseInt(req.body?.periodDays || req.body?.period_days, 10) || 180;
  let aiResult = null;

  try {
    const sourceContext = await buildSupervisorContext({ routeDate, periodDays });
    aiResult = await aiProvider.createStructuredResponse({
      endpoint: 'supervisor-brief',
      instructions: buildSupervisorBriefPrompt(),
      input: sourceContext,
      schemaName: 'truck_safe_supervisor_brief',
      schema: supervisorBriefSchema
    });

    await repositories.saveAiInteractionLog({
      endpoint: 'supervisor-brief',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: null,
      model: aiResult.model,
      status: 'success',
      inputSummary: {
        routeDate,
        periodDays,
        routeCount: sourceContext.recentRoutes.length,
        undeliveredStopCount: sourceContext.undeliveredStops.length,
        orderCount: sourceContext.recentOrders.length
      },
      outputSummary: aiResult.parsed,
      latencyMs: Date.now() - startedAt
    });

    return res.json({
      ok: true,
      requester,
      routeDate,
      sourceContext,
      ai: {
        provider: 'openai',
        model: aiResult.model,
        store: false,
        ...aiResult.parsed
      }
    });
  } catch (error) {
    await repositories.saveAiInteractionLog({
      endpoint: 'supervisor-brief',
      requesterType: requester.type,
      requesterId: requester.id,
      accountNumber: null,
      model: aiResult?.model || aiProvider.getModel(),
      status: 'error',
      inputSummary: { routeDate, periodDays },
      outputSummary: {},
      errorMessage: error.message,
      latencyMs: Date.now() - startedAt
    }).catch(() => {});

    return res.status(error.status || 500).json({
      ok: false,
      error: error.status ? error.message : 'AI supervisor brief failed.'
    });
  }
});

module.exports = router;
