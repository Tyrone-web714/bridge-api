const express = require('express');
const adminAuth = require('../services/adminAuth');
const repositories = require('../db/repositories');

const router = express.Router();

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function requireAdminSession(req, res, next) {
  const session = adminAuth.getAdminSession(req);
  if (session) {
    req.adminSession = session;
    return next();
  }
  if (req.accepts('html') && req.path === '/admin') {
    return res.redirect('/api/routing/manual-hazards/admin/login');
  }
  return res.status(401).json({ error: 'Supervisor admin login required.' });
}

function handleRouteError(res, error) {
  return res.status(error.status || 500).json({
    error: error.status ? error.message : 'Account intelligence request failed.'
  });
}

function renderAccountIntelligenceAdminPage(session) {
  const username = cleanText(session?.username || 'supervisor', 80);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truck-Safe Account Intelligence</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #061019;
      --panel: rgba(255,255,255,0.09);
      --line: rgba(255,255,255,0.16);
      --text: #f3fbff;
      --muted: #a9bdc7;
      --red: #d9212e;
      --cyan: #19d3e6;
      --gold: #ffbf3f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 12% 8%, rgba(217,33,46,0.24), transparent 28%),
        radial-gradient(circle at 86% 10%, rgba(255,191,63,0.18), transparent 28%),
        linear-gradient(160deg, #061019 0%, #102635 58%, #17070b 100%);
    }
    header { padding: 30px 36px; border-bottom: 1px solid var(--line); background: rgba(0,0,0,0.24); }
    h1 { margin: 0; font-size: clamp(32px, 4vw, 52px); line-height: 1.03; }
    h2 { margin: 0 0 12px; }
    p { color: var(--muted); line-height: 1.45; }
    main { padding: 24px 36px 52px; display: grid; gap: 18px; }
    .topbar, .actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .pill, button {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 10px 14px;
      color: var(--text);
      background: rgba(255,255,255,0.1);
      text-decoration: none;
      font-weight: 900;
      cursor: pointer;
    }
    button.primary { background: var(--cyan); color: #03151c; border: 0; }
    button.gold { background: var(--gold); color: #1c1300; border: 0; }
    .panel {
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 18px;
      background: var(--panel);
      box-shadow: 0 18px 42px rgba(0,0,0,0.24);
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
    input, textarea {
      width: 100%;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 14px;
      background: rgba(0,0,0,0.22);
      color: var(--text);
      padding: 12px;
      font: inherit;
    }
    textarea { min-height: 180px; font-family: Consolas, monospace; }
    .result-shell { display: grid; gap: 14px; }
    .empty-result {
      border: 1px dashed rgba(255,255,255,0.2);
      border-radius: 18px;
      padding: 18px;
      color: var(--muted);
      background: rgba(0,0,0,0.18);
    }
    .summary-hero {
      display: grid;
      gap: 8px;
      border-radius: 22px;
      padding: 20px;
      background: linear-gradient(135deg, rgba(25,211,230,0.24), rgba(217,33,46,0.16));
      border: 1px solid rgba(25,211,230,0.28);
    }
    .summary-title { font-size: clamp(24px, 3vw, 38px); font-weight: 900; line-height: 1.05; }
    .summary-subtitle { color: var(--muted); font-weight: 800; }
    .metric-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    .metric {
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 18px;
      padding: 16px;
      background: rgba(0,0,0,0.22);
    }
    .metric-label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; font-weight: 900; }
    .metric-value { margin-top: 6px; font-size: 28px; font-weight: 900; }
    .content-card {
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 18px;
      padding: 16px;
      background: rgba(0,0,0,0.18);
    }
    .content-card h3 { margin: 0 0 10px; font-size: 20px; }
    .product-list, .bullet-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
    .product-item {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 10px;
    }
    .product-name { font-weight: 900; }
    .product-meta { color: var(--muted); font-size: 13px; margin-top: 3px; }
    .money { color: #7dffb0; font-weight: 900; }
    .ai-summary {
      border-left: 5px solid var(--cyan);
      padding: 14px 16px;
      border-radius: 16px;
      background: rgba(25,211,230,0.12);
      color: #e9fcff;
      font-size: 17px;
      line-height: 1.45;
    }
    .badge {
      display: inline-flex;
      width: fit-content;
      border-radius: 999px;
      padding: 6px 10px;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.16);
      font-weight: 900;
      color: var(--text);
    }
    .question-box {
      min-height: 96px;
      font-family: Arial, sans-serif;
      line-height: 1.4;
    }
    .debug-details summary { cursor: pointer; color: var(--muted); font-weight: 900; }
    .debug-details pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 16px;
      padding: 14px;
      background: rgba(0,0,0,0.22);
      color: #d8f8ff;
    }
    label { display: grid; gap: 7px; color: var(--muted); font-weight: 800; }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      padding: 8px 12px;
      border: 1px solid var(--line);
      background: rgba(0,0,0,0.22);
      font-weight: 900;
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--red); }
    .dot.on { background: #7dffb0; box-shadow: 0 0 16px rgba(125,255,176,0.8); }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <a class="pill" href="/api/admin">Supervisor Dashboard</a>
      <span class="pill">${username}</span>
    </div>
    <h1>Account Intelligence</h1>
    <p>Source-of-truth product, invoice, deduction, and account-insight records for the AI logistics platform.</p>
  </header>
  <main>
    <section class="panel">
      <h2>Account Summary</h2>
      <div class="topbar" style="margin-bottom:14px">
        <span class="status"><span id="aiStatusDot" class="dot"></span><span id="aiStatusText">Checking AI...</span></span>
      </div>
      <div class="grid">
        <label>Account Number<input id="accountNumber" /></label>
        <label>Lookback Days<input id="periodDays" value="180" /></label>
      </div>
      <div class="actions" style="margin-top:14px">
        <button class="primary" onclick="loadSummary()">Load Summary</button>
        <button class="gold" onclick="generateInsight()">Generate Insight</button>
        <button onclick="runAiSummary()">Run AI Summary</button>
        <button onclick="runAccountForecast()">Account Forecast</button>
        <button onclick="runAccountGuidance()">Account Guidance Card</button>
      </div>
    </section>

    <section class="panel">
      <h2>Create Product</h2>
      <div class="grid">
        <label>SKU<input id="sku" /></label>
        <label>Product Name<input id="productName" /></label>
        <label>Brand<input id="brand" /></label>
        <label>Unit Price<input id="unitPrice" /></label>
      </div>
      <div class="actions" style="margin-top:14px">
        <button class="primary" onclick="saveProduct()">Save Product</button>
      </div>
    </section>

    <section class="panel">
      <h2>Record Product Order</h2>
      <p>Use this form to add product-level purchase history for one account. Bulk route/order imports will use the same backend record format automatically.</p>
      <div class="grid">
        <label>Account Number<input id="orderAccountNumber" /></label>
        <label>Account Name<input id="orderAccountName" /></label>
        <label>Invoice Number<input id="invoiceNumber" /></label>
        <label>Order Date<input id="orderDate" type="date" /></label>
        <label>Delivery Date<input id="deliveryDate" type="date" /></label>
        <label>Product SKU<input id="orderSku" /></label>
        <label>Product Name<input id="orderProductName" /></label>
        <label>Brand<input id="orderBrand" /></label>
        <label>Category<input id="orderCategory" /></label>
        <label>Quantity<input id="orderQuantity" type="number" min="0" step="1" /></label>
        <label>Unit Price<input id="orderUnitPrice" type="number" min="0" step="0.01" /></label>
        <label>Deduction Amount<input id="orderDeductionAmount" type="number" min="0" step="0.01" /></label>
      </div>
      <div class="actions" style="margin-top:14px">
        <button class="primary" onclick="saveOrder()">Save Product Order</button>
      </div>
    </section>

    <section class="panel">
      <h2>Ask AI</h2>
      <p>Ask a supervisor question about account spending, products, deductions, route risk, missed deliveries, or operational patterns. AI answers only from backend data available to this system.</p>
      <div class="grid">
        <label>Route Date<input id="aiRouteDate" type="date" /></label>
        <label>Optional Account Number<input id="aiAccountNumber" /></label>
        <label>Optional Route Session ID<input id="aiRouteSessionId" /></label>
      </div>
      <label style="margin-top:14px">Supervisor Question
        <textarea id="aiQuestion" class="question-box" placeholder="Example: What products are driving spending for ACCT-1001, and are there any deduction risks?"></textarea>
      </label>
      <div class="actions" style="margin-top:14px">
        <button class="primary" onclick="askSupervisorAi()">Ask AI</button>
        <button class="gold" onclick="generateSupervisorBrief()">Generate Morning Brief</button>
        <button onclick="generateRedeliveryPlan()">Redelivery Plan</button>
        <button onclick="explainRouteRisk()">Route Risk</button>
        <button onclick="summarizeDeliveryNotes()">Delivery Notes Summary</button>
      </div>
    </section>

    <section class="panel">
      <h2>Supervisor Summary</h2>
      <div id="result" class="result-shell">
        <div class="empty-result">Enter an account number, then load the account summary or run the AI summary.</div>
      </div>
    </section>
  </main>
  <script>
    const result = document.getElementById('result');
    const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, function (char) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
      });
    }
    function formatMoney(value) {
      return money.format(Number(value) || 0);
    }
    function listItems(items) {
      const rows = Array.isArray(items) ? items.filter(Boolean) : [];
      if (!rows.length) return '<div class="empty-result">No items available.</div>';
      return '<ul class="bullet-list">' + rows.map(function (item) {
        return '<li>' + escapeHtml(item) + '</li>';
      }).join('') + '</ul>';
    }
    function setError(error) {
      result.innerHTML = '<div class="empty-result">' + escapeHtml(error.message || error || 'Request failed.') + '</div>';
    }
    function renderDebug(data) {
      return '<details class="debug-details"><summary>View raw technical payload</summary><pre>' +
        escapeHtml(JSON.stringify(data, null, 2)) +
        '</pre></details>';
    }
    function renderSourceSummary(data) {
      const summary = data.summary || data.sourceSummary || {};
      const products = Array.isArray(summary.topProducts) ? summary.topProducts : [];
      const routeStop = Array.isArray(summary.recentRouteStops) ? summary.recentRouteStops[0] : null;
      result.innerHTML =
        '<div class="summary-hero">' +
          '<div class="summary-title">' + escapeHtml(summary.accountName || summary.accountNumber || 'Account') + '</div>' +
          '<div class="summary-subtitle">' + escapeHtml(summary.accountNumber || '') +
            (routeStop && routeStop.destinationAddress ? ' - ' + escapeHtml(routeStop.destinationAddress) : '') +
          '</div>' +
        '</div>' +
        '<div class="metric-row">' +
          '<div class="metric"><div class="metric-label">Orders</div><div class="metric-value">' + escapeHtml(summary.orderCount || 0) + '</div></div>' +
          '<div class="metric"><div class="metric-label">Net Spend</div><div class="metric-value">' + formatMoney(summary.netAmount) + '</div></div>' +
          '<div class="metric"><div class="metric-label">Deductions</div><div class="metric-value">' + formatMoney(summary.deductionAmount) + '</div></div>' +
          '<div class="metric"><div class="metric-label">Lookback</div><div class="metric-value">' + escapeHtml(summary.periodDays || 0) + ' days</div></div>' +
        '</div>' +
        '<div class="content-card"><h3>Top Products</h3>' +
          (products.length ? '<div class="product-list">' + products.map(function (product) {
            return '<div class="product-item">' +
              '<div><div class="product-name">' + escapeHtml(product.productName || product.sku || 'Product') + '</div>' +
              '<div class="product-meta">' + escapeHtml(product.brand || 'Unknown brand') + ' - Qty ' + escapeHtml(product.quantity || 0) + '</div></div>' +
              '<div class="money">' + formatMoney(product.netAmount) + '</div>' +
            '</div>';
          }).join('') + '</div>' : '<div class="empty-result">No product activity recorded for this period.</div>') +
        '</div>' +
        '<div class="content-card"><h3>Recent Route Context</h3>' +
          (routeStop ? '<div><strong>' + escapeHtml(routeStop.routeName || routeStop.routeNumber || 'Route') + '</strong><p>' +
            'Stop ' + escapeHtml(routeStop.stopSequence || '') + ' - ' +
            escapeHtml(routeStop.caseCount || 0) + ' cases, ' + escapeHtml(routeStop.palletCount || 0) + ' pallets. Status: ' +
            escapeHtml(routeStop.status || 'unknown') + '.</p></div>' : '<div class="empty-result">No recent route context found.</div>') +
        '</div>' +
        renderDebug(data);
    }
    function renderAiSummary(data) {
      const ai = data.ai || {};
      const source = data.sourceSummary || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Account Intelligence</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || source.accountName || data.accountNumber || 'Account Summary') + '</div>' +
          '<div class="summary-subtitle">' + escapeHtml(data.accountNumber || '') + ' - Confidence: ' + escapeHtml(ai.confidence || 'unknown') + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No AI summary returned.') + '</div>' +
        '<div class="metric-row">' +
          '<div class="metric"><div class="metric-label">Account Health</div><div class="metric-value">' + escapeHtml(ai.accountHealth || 'unknown') + '</div></div>' +
          '<div class="metric"><div class="metric-label">Orders</div><div class="metric-value">' + escapeHtml(source.orderCount || 0) + '</div></div>' +
          '<div class="metric"><div class="metric-label">Net Spend</div><div class="metric-value">' + formatMoney(source.netAmount) + '</div></div>' +
        '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Key Findings</h3>' + listItems(ai.keyFindings) + '</div>' +
          '<div class="content-card"><h3>Spending Signals</h3>' + listItems(ai.spendingSignals) + '</div>' +
          '<div class="content-card"><h3>Deduction Signals</h3>' + listItems(ai.deductionSignals) + '</div>' +
          '<div class="content-card"><h3>Recommended Actions</h3>' + listItems(ai.recommendedActions) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderSupervisorAnswer(data) {
      const ai = data.ai || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">Supervisor AI</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'AI Answer') + '</div>' +
          '<div class="summary-subtitle">Confidence: ' + escapeHtml(ai.confidence || 'unknown') + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.answer || 'No AI answer returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Facts Used</h3>' + listItems(ai.factsUsed) + '</div>' +
          '<div class="content-card"><h3>Recommendations</h3>' + listItems(ai.recommendations) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
          '<div class="content-card"><h3>Follow-Up Questions</h3>' + listItems(ai.followUpQuestions) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderSupervisorBrief(data) {
      const ai = data.ai || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">Supervisor Morning Brief</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Daily Route Brief') + '</div>' +
          '<div class="summary-subtitle">Route date: ' + escapeHtml(data.routeDate || 'today') + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No AI brief returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Route Risks</h3>' + listItems(ai.routeRisks) + '</div>' +
          '<div class="content-card"><h3>Account Risks</h3>' + listItems(ai.accountRisks) + '</div>' +
          '<div class="content-card"><h3>Product Signals</h3>' + listItems(ai.productSignals) + '</div>' +
          '<div class="content-card"><h3>Recommended Actions</h3>' + listItems(ai.recommendedActions) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderRedeliveryPlan(data) {
      const ai = data.ai || {};
      const source = data.sourceContext || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Redelivery Recovery</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Redelivery Plan') + '</div>' +
          '<div class="summary-subtitle">Route date: ' + escapeHtml(data.routeDate || 'today') +
            ' - Missed stops: ' + escapeHtml((source.undeliveredStops || []).length || 0) + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No redelivery plan returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Redelivery Candidates</h3>' + listItems(ai.redeliveryCandidates) + '</div>' +
          '<div class="content-card"><h3>Customer Contact Needed</h3>' + listItems(ai.customerContactNeeded) + '</div>' +
          '<div class="content-card"><h3>Cancel Review Candidates</h3>' + listItems(ai.cancelReviewCandidates) + '</div>' +
          '<div class="content-card"><h3>Route Planning Issues</h3>' + listItems(ai.routePlanningIssues) + '</div>' +
          '<div class="content-card"><h3>Recommended Actions</h3>' + listItems(ai.recommendedActions) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderRouteRiskExplanation(data) {
      const ai = data.ai || {};
      const route = (data.sourceContext && data.sourceContext.routeSession) || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Route Risk Explanation</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Route Risk') + '</div>' +
          '<div class="summary-subtitle">' + escapeHtml(route.originLabel || 'Origin') + ' to ' +
            escapeHtml(route.destinationLabel || 'Destination') +
            ' - Safety rating: ' + escapeHtml(ai.safetyRating || 'unknown') + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No route-risk explanation returned.') + '</div>' +
        '<div class="metric-row">' +
          '<div class="metric"><div class="metric-label">Route Session</div><div class="metric-value">' + escapeHtml(route.id || data.routeSessionId || '--') + '</div></div>' +
          '<div class="metric"><div class="metric-label">Chosen Route</div><div class="metric-value">' + escapeHtml(route.chosenRouteIndex ?? '--') + '</div></div>' +
          '<div class="metric"><div class="metric-label">Options</div><div class="metric-value">' + escapeHtml(route.routeCount || 0) + '</div></div>' +
        '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Why This Route Is Acceptable</h3>' + listItems(ai.safeRouteReasons) + '</div>' +
          '<div class="content-card"><h3>Primary Risks</h3>' + listItems(ai.primaryRisks) + '</div>' +
          '<div class="content-card"><h3>Hazard Concerns</h3>' + listItems(ai.hazardConcerns) + '</div>' +
          '<div class="content-card"><h3>Truck Profile Concerns</h3>' + listItems(ai.truckProfileConcerns) + '</div>' +
          '<div class="content-card"><h3>Route Comparison</h3>' + listItems(ai.routeComparison) + '</div>' +
          '<div class="content-card"><h3>Recommended Actions</h3>' + listItems(ai.recommendedActions) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderDeliveryNotesSummary(data) {
      const ai = data.ai || {};
      const context = data.sourceContext || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Delivery Notes Summary</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Delivery Notes Summary') + '</div>' +
          '<div class="summary-subtitle">Notes found: ' + escapeHtml((context.notes || []).length || 0) +
            (data.accountNumber ? ' - Account: ' + escapeHtml(data.accountNumber) : '') +
            (data.destination ? ' - Destination: ' + escapeHtml(data.destination) : '') +
            ' - Confidence: ' + escapeHtml(ai.confidence || 'unknown') + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No delivery-notes summary returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Account Guidance</h3>' + listItems(ai.accountGuidance) + '</div>' +
          '<div class="content-card"><h3>Access Instructions</h3>' + listItems(ai.accessInstructions) + '</div>' +
          '<div class="content-card"><h3>Delivery Risks</h3>' + listItems(ai.deliveryRisks) + '</div>' +
          '<div class="content-card"><h3>Useful Driver Tips</h3>' + listItems(ai.usefulDriverTips) + '</div>' +
          '<div class="content-card"><h3>Photo Signals</h3>' + listItems(ai.photoSignals) + '</div>' +
          '<div class="content-card"><h3>Recommended Actions</h3>' + listItems(ai.recommendedActions) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderAccountForecast(data) {
      const ai = data.ai || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Account Forecast</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || data.accountNumber || 'Account Forecast') + '</div>' +
          '<div class="summary-subtitle">Reorder likelihood: ' + escapeHtml(ai.reorderLikelihood || 'unknown') +
            ' - Account risk: ' + escapeHtml(ai.accountRisk || 'unknown') +
            ' - Confidence: ' + escapeHtml(ai.forecastConfidence || 'unknown') + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No forecast returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Product Opportunities</h3>' + listItems(ai.productOpportunities) + '</div>' +
          '<div class="content-card"><h3>Reorder Signals</h3>' + listItems(ai.reorderSignals) + '</div>' +
          '<div class="content-card"><h3>Deduction Risks</h3>' + listItems(ai.deductionRisks) + '</div>' +
          '<div class="content-card"><h3>Delivery Risks</h3>' + listItems(ai.deliveryRisks) + '</div>' +
          '<div class="content-card"><h3>Recommended Actions</h3>' + listItems(ai.recommendedActions) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderAccountGuidance(data) {
      const ai = data.ai || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Account Guidance Card</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || data.accountNumber || 'Account Guidance') + '</div>' +
          '<div class="summary-subtitle">Account: ' + escapeHtml(data.accountNumber || '') +
            ' - Confidence: ' + escapeHtml(ai.confidence || 'unknown') + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.overview || 'No account guidance returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Pre-Arrival Checklist</h3>' + listItems(ai.preArrivalChecklist) + '</div>' +
          '<div class="content-card"><h3>Delivery Instructions</h3>' + listItems(ai.deliveryInstructions) + '</div>' +
          '<div class="content-card"><h3>Product Focus</h3>' + listItems(ai.productFocus) + '</div>' +
          '<div class="content-card"><h3>Deduction Watchouts</h3>' + listItems(ai.deductionWatchouts) + '</div>' +
          '<div class="content-card"><h3>Customer Risk</h3>' + listItems(ai.customerRisk) + '</div>' +
          '<div class="content-card"><h3>Supervisor Follow-Up</h3>' + listItems(ai.supervisorFollowUp) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderSaved(value, label) {
      result.innerHTML = '<div class="summary-hero"><div class="summary-title">' + escapeHtml(label) + '</div>' +
        '<div class="summary-subtitle">Saved successfully.</div></div>' + renderDebug(value);
    }
    async function requestJson(url, options = {}) {
      const response = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || response.statusText);
      return data;
    }
    async function loadAiStatus() {
      try {
        const data = await requestJson('/api/ai/status');
        const dot = document.getElementById('aiStatusDot');
        const text = document.getElementById('aiStatusText');
        dot.classList.toggle('on', Boolean(data.ai && data.ai.configured));
        text.textContent = data.ai && data.ai.configured
          ? 'AI ready - ' + data.ai.model
          : 'AI not configured - add OPENAI_API_KEY';
      } catch (error) {
        document.getElementById('aiStatusText').textContent = 'AI status unavailable';
      }
    }
    async function loadSummary() {
      try {
        const accountNumber = encodeURIComponent(document.getElementById('accountNumber').value.trim());
        const periodDays = encodeURIComponent(document.getElementById('periodDays').value.trim() || '180');
        renderSourceSummary(await requestJson('/api/account-intelligence/accounts/' + accountNumber + '/summary?periodDays=' + periodDays));
      } catch (error) { setError(error); }
    }
    async function generateInsight() {
      try {
        const accountNumber = encodeURIComponent(document.getElementById('accountNumber').value.trim());
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        renderSaved(await requestJson('/api/account-intelligence/accounts/' + accountNumber + '/insights/generate', {
          method: 'POST',
          body: JSON.stringify({ periodDays })
        }), 'Rules-Based Insight');
      } catch (error) { setError(error); }
    }
    async function runAiSummary() {
      try {
        const accountNumber = document.getElementById('accountNumber').value.trim();
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        renderAiSummary(await requestJson('/api/ai/account-summary', {
          method: 'POST',
          body: JSON.stringify({ accountNumber, periodDays })
        }));
      } catch (error) { setError(error); }
    }
    async function runAccountForecast() {
      try {
        const accountNumber = document.getElementById('accountNumber').value.trim();
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        renderAccountForecast(await requestJson('/api/ai/account-forecast', {
          method: 'POST',
          body: JSON.stringify({
            accountNumber,
            routeDate: document.getElementById('aiRouteDate')?.value || '',
            periodDays
          })
        }));
      } catch (error) { setError(error); }
    }
    async function runAccountGuidance() {
      try {
        const accountNumber = document.getElementById('accountNumber').value.trim();
        renderAccountGuidance(await requestJson('/api/ai/account-guidance', {
          method: 'POST',
          body: JSON.stringify({
            accountNumber,
            routeDate: document.getElementById('aiRouteDate')?.value || ''
          })
        }));
      } catch (error) { setError(error); }
    }
    async function askSupervisorAi() {
      try {
        const fallbackAccountNumber = document.getElementById('accountNumber').value.trim();
        const accountNumber = document.getElementById('aiAccountNumber').value.trim() || fallbackAccountNumber;
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        renderSupervisorAnswer(await requestJson('/api/ai/supervisor-question', {
          method: 'POST',
          body: JSON.stringify({
            question: document.getElementById('aiQuestion').value,
            accountNumber,
            routeDate: document.getElementById('aiRouteDate').value,
            periodDays
          })
        }));
      } catch (error) { setError(error); }
    }
    async function generateSupervisorBrief() {
      try {
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        renderSupervisorBrief(await requestJson('/api/ai/supervisor-brief', {
          method: 'POST',
          body: JSON.stringify({
            routeDate: document.getElementById('aiRouteDate').value,
            periodDays
          })
        }));
      } catch (error) { setError(error); }
    }
    async function generateRedeliveryPlan() {
      try {
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        renderRedeliveryPlan(await requestJson('/api/ai/redelivery-plan', {
          method: 'POST',
          body: JSON.stringify({
            routeDate: document.getElementById('aiRouteDate').value,
            periodDays
          })
        }));
      } catch (error) { setError(error); }
    }
    async function explainRouteRisk() {
      try {
        renderRouteRiskExplanation(await requestJson('/api/ai/route-risk-explanation', {
          method: 'POST',
          body: JSON.stringify({
            routeSessionId: document.getElementById('aiRouteSessionId').value.trim()
          })
        }));
      } catch (error) { setError(error); }
    }
    async function summarizeDeliveryNotes() {
      try {
        const fallbackAccountNumber = document.getElementById('accountNumber').value.trim();
        const accountNumber = document.getElementById('aiAccountNumber').value.trim() || fallbackAccountNumber;
        renderDeliveryNotesSummary(await requestJson('/api/ai/delivery-notes-summary', {
          method: 'POST',
          body: JSON.stringify({
            accountNumber,
            destination: document.getElementById('aiQuestion').value.trim(),
            routeDate: document.getElementById('aiRouteDate').value
          })
        }));
      } catch (error) { setError(error); }
    }
    async function saveProduct() {
      try {
        renderSaved(await requestJson('/api/account-intelligence/products', {
          method: 'POST',
          body: JSON.stringify({
            sku: document.getElementById('sku').value,
            productName: document.getElementById('productName').value,
            brand: document.getElementById('brand').value,
            unitPrice: document.getElementById('unitPrice').value
          })
        }), 'Product');
      } catch (error) { setError(error); }
    }
    async function saveOrder() {
      try {
        const quantity = Number(document.getElementById('orderQuantity').value || 0);
        const unitPrice = Number(document.getElementById('orderUnitPrice').value || 0);
        const deductionAmount = Number(document.getElementById('orderDeductionAmount').value || 0);
        renderSaved(await requestJson('/api/account-intelligence/orders', {
          method: 'POST',
          body: JSON.stringify({
            accountNumber: document.getElementById('orderAccountNumber').value,
            accountName: document.getElementById('orderAccountName').value,
            invoiceNumber: document.getElementById('invoiceNumber').value,
            orderDate: document.getElementById('orderDate').value,
            deliveryDate: document.getElementById('deliveryDate').value,
            deductionAmount,
            items: [{
              sku: document.getElementById('orderSku').value,
              productName: document.getElementById('orderProductName').value,
              brand: document.getElementById('orderBrand').value,
              category: document.getElementById('orderCategory').value,
              quantity,
              unitPrice,
              grossAmount: quantity * unitPrice,
              deductionAmount
            }]
          })
        }), 'Order');
      } catch (error) { setError(error); }
    }
    loadAiStatus();
  </script>
</body>
</html>`;
}

router.get('/admin', requireAdminSession, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderAccountIntelligenceAdminPage(req.adminSession));
});

router.get('/products', requireAdminSession, async (req, res) => {
  try {
    const products = await repositories.listProducts(req.query || {});
    return res.json({ products });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post('/products', requireAdminSession, async (req, res) => {
  try {
    const product = await repositories.upsertProduct(req.body || {});
    return res.status(201).json({ product });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get('/orders', requireAdminSession, async (req, res) => {
  try {
    const orders = await repositories.listAccountOrders(req.query || {});
    return res.json({ orders });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post('/orders', requireAdminSession, async (req, res) => {
  try {
    const order = await repositories.createAccountOrder(req.body || {});
    return res.status(201).json({ order });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get('/orders/:id', requireAdminSession, async (req, res) => {
  try {
    const order = await repositories.getAccountOrder(req.params.id);
    if (!order) return res.status(404).json({ error: 'Account order not found.' });
    return res.json({ order });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post('/deductions', requireAdminSession, async (req, res) => {
  try {
    const deduction = await repositories.recordDeliveryDeduction(req.body || {});
    return res.status(201).json({ deduction });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get('/accounts/:accountNumber/summary', requireAdminSession, async (req, res) => {
  try {
    const summary = await repositories.getAccountProductSummary(req.params.accountNumber, req.query || {});
    return res.json({ summary });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get('/accounts/:accountNumber/insights', requireAdminSession, async (req, res) => {
  try {
    const insights = await repositories.listAccountInsights({
      ...req.query,
      accountNumber: req.params.accountNumber
    });
    return res.json({ insights });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.post('/accounts/:accountNumber/insights/generate', requireAdminSession, async (req, res) => {
  try {
    const insight = await repositories.generateAccountInsight(req.params.accountNumber, {
      ...(req.body || {}),
      generatedBy: req.adminSession?.username || 'supervisor'
    });
    return res.status(201).json({ insight });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

module.exports = router;
