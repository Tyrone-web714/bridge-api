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
    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 16px;
      padding: 14px;
      background: rgba(0,0,0,0.22);
      color: #d8f8ff;
    }
    label { display: grid; gap: 7px; color: var(--muted); font-weight: 800; }
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
      <div class="grid">
        <label>Account Number<input id="accountNumber" placeholder="Example: ACCT-4337" /></label>
        <label>Lookback Days<input id="periodDays" value="180" /></label>
      </div>
      <div class="actions" style="margin-top:14px">
        <button class="primary" onclick="loadSummary()">Load Summary</button>
        <button class="gold" onclick="generateInsight()">Generate Insight</button>
      </div>
    </section>

    <section class="panel">
      <h2>Create Product</h2>
      <div class="grid">
        <label>SKU<input id="sku" placeholder="SKU-12PK-COKE" /></label>
        <label>Product Name<input id="productName" placeholder="Coca-Cola 12 Pack" /></label>
        <label>Brand<input id="brand" placeholder="Coca-Cola" /></label>
        <label>Unit Price<input id="unitPrice" placeholder="9.99" /></label>
      </div>
      <div class="actions" style="margin-top:14px">
        <button class="primary" onclick="saveProduct()">Save Product</button>
      </div>
    </section>

    <section class="panel">
      <h2>Create Order JSON</h2>
      <p>Paste a product-level order. This is the structure the future route/import pipeline will generate automatically.</p>
      <textarea id="orderJson">{
  "accountNumber": "ACCT-4337",
  "accountName": "Example Account",
  "invoiceNumber": "INV-1001",
  "orderDate": "2026-06-04",
  "deliveryDate": "2026-06-04",
  "items": [
    {
      "sku": "SKU-12PK-COKE",
      "productName": "Coca-Cola 12 Pack",
      "brand": "Coca-Cola",
      "quantity": 10,
      "unitPrice": 9.99
    }
  ]
}</textarea>
      <div class="actions" style="margin-top:14px">
        <button class="primary" onclick="saveOrder()">Save Order</button>
      </div>
    </section>

    <section class="panel">
      <h2>Result</h2>
      <pre id="result">Ready.</pre>
    </section>
  </main>
  <script>
    const result = document.getElementById('result');
    function show(value) { result.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); }
    async function requestJson(url, options = {}) {
      const response = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || response.statusText);
      return data;
    }
    async function loadSummary() {
      try {
        const accountNumber = encodeURIComponent(document.getElementById('accountNumber').value.trim());
        const periodDays = encodeURIComponent(document.getElementById('periodDays').value.trim() || '180');
        show(await requestJson('/api/account-intelligence/accounts/' + accountNumber + '/summary?periodDays=' + periodDays));
      } catch (error) { show(error.message); }
    }
    async function generateInsight() {
      try {
        const accountNumber = encodeURIComponent(document.getElementById('accountNumber').value.trim());
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        show(await requestJson('/api/account-intelligence/accounts/' + accountNumber + '/insights/generate', {
          method: 'POST',
          body: JSON.stringify({ periodDays })
        }));
      } catch (error) { show(error.message); }
    }
    async function saveProduct() {
      try {
        show(await requestJson('/api/account-intelligence/products', {
          method: 'POST',
          body: JSON.stringify({
            sku: document.getElementById('sku').value,
            productName: document.getElementById('productName').value,
            brand: document.getElementById('brand').value,
            unitPrice: document.getElementById('unitPrice').value
          })
        }));
      } catch (error) { show(error.message); }
    }
    async function saveOrder() {
      try {
        show(await requestJson('/api/account-intelligence/orders', {
          method: 'POST',
          body: document.getElementById('orderJson').value
        }));
      } catch (error) { show(error.message); }
    }
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
