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
    }))
  };
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

module.exports = router;
