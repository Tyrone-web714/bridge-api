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
  if (req.accepts('html') && req.path.endsWith('/admin')) {
    return res.redirect('/api/routing/manual-hazards/admin/login');
  }
  return res.status(401).json({ error: 'Supervisor admin login required.' });
}

function handleRouteError(res, error) {
  return res.status(error.status || 500).json({
    error: error.status ? error.message : 'Account intelligence request failed.'
  });
}

function insightPriority(insight = {}) {
  const raw = insight.raw || {};
  const riskValues = [
    raw.overallDeductionRisk,
    raw.accountRisk,
    raw.overallRisk,
    raw.deliveryFailureRisk,
    raw.riskLevel
  ].map((value) => cleanText(value, 40).toLowerCase());
  if (riskValues.some((value) => ['critical', 'very_high', 'very high'].includes(value))) return 'critical';
  if (riskValues.some((value) => ['high', 'elevated'].includes(value))) return 'high';
  if (insight.confidence === 'high' && riskValues.some((value) => value === 'medium')) return 'high';
  if (riskValues.some((value) => ['medium', 'moderate'].includes(value))) return 'medium';
  if (insight.confidence === 'high') return 'medium';
  return 'normal';
}

function insightWithPriority(insight) {
  return {
    ...insight,
    priority: insightPriority(insight)
  };
}

function renderSupervisorIntelligenceQueue(session) {
  const username = cleanText(session?.username || 'supervisor', 80);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Supervisor Intelligence Queue</title>
  <style>
    :root {
      color-scheme: dark;
      --bg:#061019; --panel:#102536; --line:rgba(255,255,255,.16);
      --text:#f3fbff; --muted:#a9bdc7; --cyan:#19d3e6; --red:#ff5964;
      --gold:#ffbf3f; --green:#55e08a; --purple:#c084fc;
    }
    * { box-sizing:border-box; }
    body {
      margin:0; min-height:100vh; font-family:Arial,sans-serif; color:var(--text);
      background:
        radial-gradient(circle at 12% 8%,rgba(192,132,252,.18),transparent 28%),
        radial-gradient(circle at 88% 8%,rgba(25,211,230,.15),transparent 28%),
        linear-gradient(155deg,#061019,#0b2231 58%,#140b1b);
    }
    header {
      padding:28px clamp(18px,4vw,48px); border-bottom:1px solid var(--line);
      background:rgba(0,0,0,.24);
    }
    .topline { display:flex; justify-content:space-between; gap:18px; align-items:center; flex-wrap:wrap; }
    h1 { margin:12px 0 0; font-size:clamp(30px,4vw,48px); }
    p { color:var(--muted); line-height:1.45; }
    .pill,button {
      border:1px solid var(--line); border-radius:999px; padding:10px 14px;
      color:var(--text); background:rgba(255,255,255,.09); text-decoration:none;
      font:inherit; font-weight:900; cursor:pointer;
    }
    button.primary { border:0; color:#03151c; background:var(--cyan); }
    button.reject { border-color:rgba(255,89,100,.5); background:rgba(255,89,100,.18); }
    button:disabled { cursor:wait; opacity:.6; }
    main { padding:22px clamp(18px,4vw,48px) 50px; }
    .filters {
      display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px;
      padding:16px; border:1px solid var(--line); border-radius:16px;
      background:rgba(16,37,54,.88);
    }
    label { display:grid; gap:6px; color:var(--muted); font-size:12px; font-weight:900; }
    input,select,textarea {
      width:100%; border:1px solid var(--line); border-radius:10px; padding:11px;
      color:var(--text); background:#071722; font:inherit;
    }
    select option { color:var(--text); background:#071722; }
    .metrics { display:grid; grid-template-columns:repeat(4,minmax(120px,1fr)); gap:10px; margin:16px 0; }
    .metric { padding:14px; border:1px solid var(--line); border-radius:14px; background:rgba(255,255,255,.055); }
    .metric span { display:block; color:var(--muted); font-size:10px; font-weight:900; text-transform:uppercase; }
    .metric strong { display:block; margin-top:5px; font-size:24px; }
    .queue { display:grid; gap:14px; }
    .card {
      border:1px solid var(--line); border-left:6px solid var(--priority);
      border-radius:16px; padding:17px; background:rgba(16,37,54,.9);
      box-shadow:0 16px 36px rgba(0,0,0,.2);
    }
    .card-head { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; flex-wrap:wrap; }
    .card h2 { margin:0; font-size:20px; }
    .badges { display:flex; gap:7px; flex-wrap:wrap; margin:9px 0; }
    .badge {
      border-radius:999px; padding:5px 9px; background:rgba(255,255,255,.09);
      color:var(--muted); font-size:10px; font-weight:900; text-transform:uppercase;
    }
    .badge.priority { color:#061019; background:var(--priority); }
    .summary { margin:10px 0; color:#e8f6fb; line-height:1.5; }
    .meta { color:var(--muted); font-size:12px; line-height:1.5; }
    .details { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:9px; margin-top:12px; }
    .detail { padding:10px; border-radius:10px; background:rgba(0,0,0,.18); color:var(--muted); font-size:12px; }
    .detail strong { display:block; margin-bottom:4px; color:var(--cyan); font-size:10px; text-transform:uppercase; }
    .review { display:grid; grid-template-columns:1fr auto auto; gap:9px; align-items:end; margin-top:14px; }
    .empty { padding:22px; border:1px dashed var(--line); border-radius:16px; color:var(--muted); text-align:center; }
    .status { margin-top:12px; color:var(--muted); font-size:12px; }
    @media(max-width:720px) {
      .metrics { grid-template-columns:1fr 1fr; }
      .review { grid-template-columns:1fr; }
    }
  </style>
</head>
<body>
  <header>
    <div class="topline">
      <div>
        <a class="pill" href="/api/admin">Supervisor Dashboard</a>
        <h1>Supervisor Intelligence Queue</h1>
        <p>Review AI-generated recommendations before they influence operational decisions. AI remains advisory; supervisors approve or reject each finding.</p>
      </div>
      <div class="badge">Signed in: ${username}</div>
    </div>
  </header>
  <main>
    <section class="filters">
      <label>Review Status
        <select id="statusFilter">
          <option value="pending_review">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All statuses</option>
        </select>
      </label>
      <label>Priority
        <select id="priorityFilter">
          <option value="">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="normal">Normal</option>
        </select>
      </label>
      <label>Confidence
        <select id="confidenceFilter">
          <option value="">All confidence levels</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label>Account Number<input id="accountFilter" placeholder="Search account" /></label>
      <label>Insight Type<input id="typeFilter" placeholder="Example: deduction risk" /></label>
      <button class="primary" id="refreshButton" type="button">Refresh Queue</button>
    </section>
    <section class="metrics">
      <div class="metric"><span>Visible</span><strong id="visibleCount">0</strong></div>
      <div class="metric"><span>Critical / High</span><strong id="priorityCount">0</strong></div>
      <div class="metric"><span>Pending</span><strong id="pendingCount">0</strong></div>
      <div class="metric"><span>High Confidence</span><strong id="confidenceCount">0</strong></div>
    </section>
    <section id="queue" class="queue"><div class="empty">Loading supervisor recommendations...</div></section>
    <div id="status" class="status"></div>
  </main>
  <script>
    let insights = [];
    const priorityColors = {
      critical:'#ff5964', high:'#ff8a4c', medium:'#ffbf3f', normal:'#55e08a'
    };
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g,function(char){
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char];
      });
    }
    function formatDate(value) {
      if (!value) return 'Not recorded';
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
    }
    function humanize(value) {
      return String(value || 'General recommendation').replace(/^openai_/,'').replace(/_/g,' ');
    }
    function rawList(raw, keys) {
      for (const key of keys) {
        if (Array.isArray(raw && raw[key]) && raw[key].length) return raw[key].slice(0,4);
      }
      return [];
    }
    function render() {
      const priority = document.getElementById('priorityFilter').value;
      const confidence = document.getElementById('confidenceFilter').value;
      const account = document.getElementById('accountFilter').value.trim().toLowerCase();
      const type = document.getElementById('typeFilter').value.trim().toLowerCase();
      const visible = insights.filter(function(insight) {
        return (!priority || insight.priority === priority) &&
          (!confidence || insight.confidence === confidence) &&
          (!account || String(insight.accountNumber || '').toLowerCase().includes(account)) &&
          (!type || humanize(insight.insightType).toLowerCase().includes(type));
      });
      document.getElementById('visibleCount').textContent = visible.length;
      document.getElementById('priorityCount').textContent =
        visible.filter(function(item){ return ['critical','high'].includes(item.priority); }).length;
      document.getElementById('pendingCount').textContent =
        visible.filter(function(item){ return item.status === 'pending_review'; }).length;
      document.getElementById('confidenceCount').textContent =
        visible.filter(function(item){ return item.confidence === 'high'; }).length;
      const queue = document.getElementById('queue');
      if (!visible.length) {
        queue.innerHTML = '<div class="empty">No recommendations match the selected filters.</div>';
        return;
      }
      queue.innerHTML = visible.map(function(insight) {
        const raw = insight.raw || {};
        const actions = rawList(raw,['recommendedActions','supervisorActions','supervisorFollowUp']);
        const risks = rawList(raw,['deductionPatterns','accountRiskSignals','deliveryRisks','customerRisk']);
        const color = priorityColors[insight.priority] || priorityColors.normal;
        return '<article class="card" style="--priority:'+color+'">' +
          '<div class="card-head"><div><h2>'+escapeHtml(insight.title)+'</h2>' +
          '<div class="badges"><span class="badge priority">'+escapeHtml(insight.priority)+'</span>' +
          '<span class="badge">'+escapeHtml(humanize(insight.insightType))+'</span>' +
          '<span class="badge">'+escapeHtml(insight.status)+'</span></div></div>' +
          '<div class="meta">Created '+escapeHtml(formatDate(insight.createdAt))+'</div></div>' +
          '<div class="summary">'+escapeHtml(insight.summary)+'</div>' +
          '<div class="details">' +
            '<div class="detail"><strong>Account</strong>'+escapeHtml(insight.accountNumber || 'Not linked')+'</div>' +
            '<div class="detail"><strong>Confidence</strong>'+escapeHtml(insight.confidence || 'unknown')+'</div>' +
            '<div class="detail"><strong>Source period</strong>'+escapeHtml(insight.sourcePeriodStart || 'Not recorded')+
              ' through '+escapeHtml(insight.sourcePeriodEnd || 'Not recorded')+'</div>' +
            '<div class="detail"><strong>Generated by</strong>'+escapeHtml(insight.generatedBy || 'system')+'</div>' +
            (risks.length ? '<div class="detail"><strong>Risk signals</strong>'+risks.map(escapeHtml).join('<br>')+'</div>' : '') +
            (actions.length ? '<div class="detail"><strong>Recommended actions</strong>'+actions.map(escapeHtml).join('<br>')+'</div>' : '') +
            (insight.reviewedBy ? '<div class="detail"><strong>Reviewed</strong>'+escapeHtml(insight.reviewedBy)+
              ' at '+escapeHtml(formatDate(insight.reviewedAt))+
              (insight.reviewNotes ? '<br>'+escapeHtml(insight.reviewNotes) : '')+'</div>' : '') +
          '</div>' +
          (insight.status === 'pending_review'
            ? '<div class="review"><label>Supervisor Review Notes<textarea id="notes-'+escapeHtml(insight.id)+
              '" rows="2" placeholder="Reason for approving or rejecting"></textarea></label>' +
              '<button class="primary" onclick="reviewInsight(\\''+escapeHtml(insight.id)+'\\',\\'approved\\')">Approve</button>' +
              '<button class="reject" onclick="reviewInsight(\\''+escapeHtml(insight.id)+'\\',\\'rejected\\')">Reject</button></div>'
            : '') +
        '</article>';
      }).join('');
    }
    async function loadQueue() {
      const button = document.getElementById('refreshButton');
      const status = document.getElementById('statusFilter').value;
      button.disabled = true;
      document.getElementById('status').textContent = 'Loading recommendations...';
      try {
        const response = await fetch('/api/account-intelligence/insights?status='+encodeURIComponent(status)+'&limit=200');
        const data = await response.json().catch(function(){ return {}; });
        if (!response.ok) throw new Error(data.error || 'Recommendation queue request failed.');
        insights = Array.isArray(data.insights) ? data.insights : [];
        render();
        document.getElementById('status').textContent =
          'Loaded '+insights.length+' recommendation'+(insights.length === 1 ? '' : 's')+'.';
      } catch (error) {
        document.getElementById('queue').innerHTML = '<div class="empty">'+escapeHtml(error.message)+'</div>';
        document.getElementById('status').textContent = '';
      } finally {
        button.disabled = false;
      }
    }
    async function reviewInsight(id, reviewStatus) {
      const notes = document.getElementById('notes-'+id);
      try {
        const response = await fetch('/api/account-intelligence/insights/'+encodeURIComponent(id)+'/review',{
          method:'PUT',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({status:reviewStatus,reviewNotes:notes ? notes.value.trim() : ''})
        });
        const data = await response.json().catch(function(){ return {}; });
        if (!response.ok) throw new Error(data.error || 'Review action failed.');
        await loadQueue();
      } catch (error) {
        document.getElementById('status').textContent = error.message || 'Review action failed.';
      }
    }
    ['priorityFilter','confidenceFilter','accountFilter','typeFilter'].forEach(function(id){
      document.getElementById(id).addEventListener(id.includes('Filter') && ['accountFilter','typeFilter'].includes(id) ? 'input' : 'change',render);
    });
    document.getElementById('statusFilter').addEventListener('change',loadQueue);
    document.getElementById('refreshButton').addEventListener('click',loadQueue);
    loadQueue();
  </script>
</body>
</html>`;
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
        <label>Optional Driver ID<input id="aiDriverId" /></label>
      </div>
      <label style="margin-top:14px">Supervisor Question
        <textarea id="aiQuestion" class="question-box" placeholder="Example: What products are driving spending for ACCT-1001, and are there any deduction risks?"></textarea>
      </label>
      <div class="actions" style="margin-top:14px">
        <button class="gold" onclick="generateUnifiedDashboard()">Unified Intelligence Dashboard</button>
        <button onclick="loadAiOperations()">AI Operations</button>
        <button onclick="loadRecommendationReview()">Recommendation Review</button>
        <button class="primary" onclick="askSupervisorAi()">Ask AI</button>
        <button class="gold" onclick="generateSupervisorBrief()">Generate Morning Brief</button>
        <button onclick="generateRedeliveryPlan()">Redelivery Plan</button>
        <button onclick="explainRouteRisk()">Route Risk</button>
        <button onclick="summarizeDeliveryNotes()">Delivery Notes Summary</button>
        <button onclick="predictDeliveryFailure()">Delivery Failure Risk</button>
        <button onclick="predictDeductionRisk()">Deduction Risk</button>
        <button onclick="forecastProductDemand()">Product Demand Forecast</button>
        <button onclick="predictRouteCompletion()">Route Completion Prediction</button>
        <button onclick="analyzeOperationalHeatmap()">Operational Hotspots</button>
        <a class="pill" href="/api/operational-heatmaps/admin">Open Visual Heatmaps</a>
        <button onclick="analyzeDriverCoaching()">Driver Coaching</button>
        <button onclick="reconstructIncident()">Incident Reconstruction</button>
        <button onclick="runWhatIfSimulation()">What-If Simulation</button>
        <button onclick="analyzeKnowledgeGraph()">Knowledge Graph</button>
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
    function renderDeliveryFailureRisk(data) {
      const ai = data.ai || {};
      const context = data.sourceContext || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Delivery Failure Risk</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Delivery Failure Risk') + '</div>' +
          '<div class="summary-subtitle">Route date: ' + escapeHtml(data.routeDate || 'today') +
            ' - Overall risk: ' + escapeHtml(ai.overallRisk || 'unknown') +
            ' - Confidence: ' + escapeHtml(ai.confidence || 'unknown') +
            ' - Missed stops in context: ' + escapeHtml((context.undeliveredStops || []).length || 0) + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No failure-risk summary returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>High-Risk Stops</h3>' + listItems(ai.highRiskStops) + '</div>' +
          '<div class="content-card"><h3>Risk Factors</h3>' + listItems(ai.riskFactors) + '</div>' +
          '<div class="content-card"><h3>Time Window Concerns</h3>' + listItems(ai.timeWindowConcerns) + '</div>' +
          '<div class="content-card"><h3>Deduction Concerns</h3>' + listItems(ai.deductionConcerns) + '</div>' +
          '<div class="content-card"><h3>Redelivery Concerns</h3>' + listItems(ai.redeliveryConcerns) + '</div>' +
          '<div class="content-card"><h3>Recommended Actions</h3>' + listItems(ai.recommendedActions) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderDeductionRisk(data) {
      const ai = data.ai || {};
      const context = data.sourceContext || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Deduction Risk Prediction</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Deduction Risk') + '</div>' +
          '<div class="summary-subtitle">Route date: ' + escapeHtml(data.routeDate || 'today') +
            ' - Overall deduction risk: ' + escapeHtml(ai.overallDeductionRisk || 'unknown') +
            ' - Confidence: ' + escapeHtml(ai.confidence || 'unknown') +
            ' - Orders in context: ' + escapeHtml((context.recentOrders || []).length || 0) + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No deduction-risk summary returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Highest-Risk Products</h3>' + listItems(ai.highestRiskProducts) + '</div>' +
          '<div class="content-card"><h3>Account Risk Signals</h3>' + listItems(ai.accountRiskSignals) + '</div>' +
          '<div class="content-card"><h3>Deduction Patterns</h3>' + listItems(ai.deductionPatterns) + '</div>' +
          '<div class="content-card"><h3>Driver Checkpoints</h3>' + listItems(ai.driverCheckpoints) + '</div>' +
          '<div class="content-card"><h3>Supervisor Actions</h3>' + listItems(ai.supervisorActions) + '</div>' +
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
    function renderProductDemandForecast(data) {
      const ai = data.ai || {};
      const context = data.sourceContext || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Product Demand Forecast</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Product Demand Forecast') + '</div>' +
          '<div class="summary-subtitle">Demand outlook: ' + escapeHtml(ai.demandOutlook || 'unknown') +
            ' - Confidence: ' + escapeHtml(ai.demandConfidence || 'unknown') +
            ' - Product signals: ' + escapeHtml((context.productSignals || []).length || 0) + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No product-demand forecast returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Products to Watch</h3>' + listItems(ai.productsToWatch) + '</div>' +
          '<div class="content-card"><h3>Category Signals</h3>' + listItems(ai.categorySignals) + '</div>' +
          '<div class="content-card"><h3>Reorder Signals</h3>' + listItems(ai.reorderSignals) + '</div>' +
          '<div class="content-card"><h3>Demand Risks</h3>' + listItems(ai.demandRisks) + '</div>' +
          '<div class="content-card"><h3>Route Load Signals</h3>' + listItems(ai.routeLoadSignals) + '</div>' +
          '<div class="content-card"><h3>Supervisor Actions</h3>' + listItems(ai.supervisorActions) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderRouteCompletionPrediction(data) {
      const ai = data.ai || {};
      const context = data.sourceContext || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Route Completion Prediction</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Route Completion Prediction') + '</div>' +
          '<div class="summary-subtitle">Route date: ' + escapeHtml(data.routeDate || 'today') +
            ' - Overall risk: ' + escapeHtml(ai.overallCompletionRisk || 'unknown') +
            ' - Confidence: ' + escapeHtml(ai.confidence || 'unknown') +
            ' - Routes analyzed: ' + escapeHtml((context.routeSignals || []).length || 0) + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No route-completion prediction returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>On-Time Routes</h3>' + listItems(ai.onTimeRoutes) + '</div>' +
          '<div class="content-card"><h3>At-Risk Routes</h3>' + listItems(ai.atRiskRoutes) + '</div>' +
          '<div class="content-card"><h3>Likely Late Routes</h3>' + listItems(ai.likelyLateRoutes) + '</div>' +
          '<div class="content-card"><h3>Route Blockers</h3>' + listItems(ai.routeBlockers) + '</div>' +
          '<div class="content-card"><h3>Supervisor Actions</h3>' + listItems(ai.supervisorActions) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderOperationalHeatmap(data) {
      const ai = data.ai || {};
      const source = data.sourceSummary || {};
      const clusterItems = (source.clusters || []).slice(0, 12).map(function (cluster) {
        const address = (cluster.destinationAddresses || [])[0];
        const location = address || (cluster.latitude + ', ' + cluster.longitude);
        return cluster.category + ' - ' + location + ' - ' + cluster.signalCount +
          ' signal(s), weight ' + cluster.totalWeight;
      });
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Operational Heatmap Intelligence</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Operational Hotspots') + '</div>' +
          '<div class="summary-subtitle">Hotspot severity: ' + escapeHtml(ai.hotspotSeverity || 'unknown') +
            ' - Confidence: ' + escapeHtml(ai.confidence || 'unknown') +
            ' - Signals: ' + escapeHtml(source.signalCount || 0) +
            ' - Clusters: ' + escapeHtml((source.clusters || []).length || 0) + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No hotspot analysis returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Highest-Weight Clusters</h3>' + listItems(clusterItems) + '</div>' +
          '<div class="content-card"><h3>High-Priority Areas</h3>' + listItems(ai.highPriorityAreas) + '</div>' +
          '<div class="content-card"><h3>Category Patterns</h3>' + listItems(ai.categoryPatterns) + '</div>' +
          '<div class="content-card"><h3>Recurring Signals</h3>' + listItems(ai.recurringSignals) + '</div>' +
          '<div class="content-card"><h3>Supervisor Actions</h3>' + listItems(ai.supervisorActions) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderDriverCoaching(data) {
      const ai = data.ai || {};
      const context = data.sourceContext || {};
      const metrics = (context.driverSignals || []).slice(0, 20).map(function (driver) {
        return (driver.driverName || driver.driverId || 'Unknown driver') +
          ' - routes ' + (driver.routeCount || 0) +
          ', completed stops ' + (driver.finishedStopCount || 0) + '/' + (driver.stopCount || 0) +
          ', late arrivals ' + (driver.lateArrivalCount || 0) +
          ', undelivered ' + (driver.undeliveredStopCount || 0);
      });
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Driver Coaching Intelligence</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Driver Coaching') + '</div>' +
          '<div class="summary-subtitle">Driver: ' + escapeHtml(data.driverId || 'all drivers') +
            ' - Coaching priority: ' + escapeHtml(ai.coachingPriority || 'unknown') +
            ' - Confidence: ' + escapeHtml(ai.confidence || 'unknown') +
            ' - Drivers analyzed: ' + escapeHtml((context.driverSignals || []).length || 0) + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No driver coaching analysis returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Recorded Metrics</h3>' + listItems(metrics) + '</div>' +
          '<div class="content-card"><h3>Observed Strengths</h3>' + listItems(ai.observedStrengths) + '</div>' +
          '<div class="content-card"><h3>Efficiency Opportunities</h3>' + listItems(ai.efficiencyOpportunities) + '</div>' +
          '<div class="content-card"><h3>Safety Observations</h3>' + listItems(ai.safetyObservations) + '</div>' +
          '<div class="content-card"><h3>Schedule Observations</h3>' + listItems(ai.scheduleObservations) + '</div>' +
          '<div class="content-card"><h3>Recommended Coaching</h3>' + listItems(ai.recommendedCoaching) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderIncidentReconstruction(data) {
      const ai = data.ai || {};
      const context = data.sourceContext || {};
      const eventItems = (context.events || []).slice(0, 30).map(function (event) {
        const location = event.latitude != null && event.longitude != null
          ? ' at ' + event.latitude + ', ' + event.longitude
          : '';
        return (event.createdAt || 'Unknown time') + ' - ' + (event.eventType || 'event') +
          (event.severity ? ' [' + event.severity + ']' : '') + location;
      });
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Incident Reconstruction</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Incident Reconstruction') + '</div>' +
          '<div class="summary-subtitle">Route session: ' + escapeHtml(data.routeSessionId || '') +
            ' - Recorded events: ' + escapeHtml(context.eventCount || 0) +
            ' - Confidence: ' + escapeHtml(ai.confidence || 'unknown') + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No incident reconstruction returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Recorded Event Log</h3>' + listItems(eventItems) + '</div>' +
          '<div class="content-card"><h3>Reconstructed Timeline</h3>' + listItems(ai.timeline) + '</div>' +
          '<div class="content-card"><h3>Confirmed Facts</h3>' + listItems(ai.confirmedFacts) + '</div>' +
          '<div class="content-card"><h3>Unresolved Questions</h3>' + listItems(ai.unresolvedQuestions) + '</div>' +
          '<div class="content-card"><h3>Operational Impact</h3>' + listItems(ai.operationalImpact) + '</div>' +
          '<div class="content-card"><h3>Recommended Follow-Up</h3>' + listItems(ai.recommendedFollowUp) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderWhatIfSimulation(data) {
      const ai = data.ai || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI What-If Simulation</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'What-If Simulation') + '</div>' +
          '<div class="summary-subtitle">Hypothetical only - no operational changes applied - Confidence: ' +
            escapeHtml(ai.confidence || 'unknown') + '</div>' +
        '</div>' +
        '<div class="ai-summary"><strong>Scenario:</strong> ' + escapeHtml(ai.scenario || data.scenario || '') +
          '<br><br>' + escapeHtml(ai.summary || 'No simulation summary returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Assumptions</h3>' + listItems(ai.assumptions) + '</div>' +
          '<div class="content-card"><h3>Expected Operational Effects</h3>' + listItems(ai.expectedOperationalEffects) + '</div>' +
          '<div class="content-card"><h3>Route Effects</h3>' + listItems(ai.routeEffects) + '</div>' +
          '<div class="content-card"><h3>Customer Effects</h3>' + listItems(ai.customerEffects) + '</div>' +
          '<div class="content-card"><h3>Product Effects</h3>' + listItems(ai.productEffects) + '</div>' +
          '<div class="content-card"><h3>Risks</h3>' + listItems(ai.risks) + '</div>' +
          '<div class="content-card"><h3>Recommended Tests</h3>' + listItems(ai.recommendedTests) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderKnowledgeGraph(data) {
      const ai = data.ai || {};
      const graph = data.graph || {};
      const nodeCounts = Object.entries(graph.nodeTypeCounts || {}).map(function (entry) {
        return entry[0] + ': ' + entry[1];
      });
      const edgeCounts = Object.entries(graph.edgeTypeCounts || {}).map(function (entry) {
        return entry[0] + ': ' + entry[1];
      });
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Knowledge Graph Foundation</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Logistics Knowledge Graph') + '</div>' +
          '<div class="summary-subtitle">Nodes: ' + escapeHtml(graph.nodeCount || 0) +
            ' - Relationships: ' + escapeHtml(graph.edgeCount || 0) +
            ' - Confidence: ' + escapeHtml(ai.confidence || 'unknown') + '</div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.summary || 'No knowledge-graph analysis returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Entity Counts</h3>' + listItems(nodeCounts) + '</div>' +
          '<div class="content-card"><h3>Relationship Counts</h3>' + listItems(edgeCounts) + '</div>' +
          '<div class="content-card"><h3>Important Relationships</h3>' + listItems(ai.importantRelationships) + '</div>' +
          '<div class="content-card"><h3>Operational Patterns</h3>' + listItems(ai.operationalPatterns) + '</div>' +
          '<div class="content-card"><h3>Account-Product Connections</h3>' + listItems(ai.accountProductConnections) + '</div>' +
          '<div class="content-card"><h3>Route-Driver Connections</h3>' + listItems(ai.routeDriverConnections) + '</div>' +
          '<div class="content-card"><h3>Data Gaps</h3>' + listItems(ai.dataGaps) + '</div>' +
          '<div class="content-card"><h3>Recommended Connections</h3>' + listItems(ai.recommendedConnections) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderUnifiedDashboard(data) {
      const ai = data.ai || {};
      const source = data.sourceSummary || {};
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">Unified Supervisor Intelligence</span>' +
          '<div class="summary-title">' + escapeHtml(ai.title || 'Supervisor Intelligence Dashboard') + '</div>' +
          '<div class="summary-subtitle">Overall status: ' + escapeHtml(ai.overallStatus || 'unknown') +
            ' - Confidence: ' + escapeHtml(ai.confidence || 'unknown') +
            ' - Routes: ' + escapeHtml(source.routeCount || 0) +
            ' - Drivers: ' + escapeHtml(source.driverCount || 0) +
            ' - Hotspot signals: ' + escapeHtml(source.hotspotSignalCount || 0) + '</div>' +
        '</div>' +
        '<div class="metric-row">' +
          '<div class="metric"><div class="metric-label">Undelivered Stops</div><div class="metric-value">' + escapeHtml(source.undeliveredStopCount || 0) + '</div></div>' +
          '<div class="metric"><div class="metric-label">Product Signals</div><div class="metric-value">' + escapeHtml(source.productSignalCount || 0) + '</div></div>' +
          '<div class="metric"><div class="metric-label">Graph Links</div><div class="metric-value">' + escapeHtml(source.graphEdgeCount || 0) + '</div></div>' +
        '</div>' +
        '<div class="ai-summary">' + escapeHtml(ai.executiveSummary || 'No executive summary returned.') + '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Critical Alerts</h3>' + listItems(ai.criticalAlerts) + '</div>' +
          '<div class="content-card"><h3>Route Priorities</h3>' + listItems(ai.routePriorities) + '</div>' +
          '<div class="content-card"><h3>Account Priorities</h3>' + listItems(ai.accountPriorities) + '</div>' +
          '<div class="content-card"><h3>Product Priorities</h3>' + listItems(ai.productPriorities) + '</div>' +
          '<div class="content-card"><h3>Driver Support Priorities</h3>' + listItems(ai.driverSupportPriorities) + '</div>' +
          '<div class="content-card"><h3>Hotspot Priorities</h3>' + listItems(ai.hotspotPriorities) + '</div>' +
          '<div class="content-card"><h3>Strategic Opportunities</h3>' + listItems(ai.strategicOpportunities) + '</div>' +
          '<div class="content-card"><h3>Next Actions</h3>' + listItems(ai.nextActions) + '</div>' +
          '<div class="content-card"><h3>Missing Data</h3>' + listItems(ai.missingData) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderAiOperations(data) {
      const ai = data.ai || {};
      const metrics = data.metrics || {};
      const overall = metrics.overall || {};
      const endpointItems = (metrics.endpoints || []).map(function (endpoint) {
        return endpoint.endpoint + ' - ' + endpoint.requestCount + ' requests, ' +
          (endpoint.successRate == null ? '--' : endpoint.successRate + '%') + ' successful, ' +
          'average ' + (endpoint.averageLatencyMs == null ? '--' : endpoint.averageLatencyMs + ' ms') +
          ', p95 ' + (endpoint.p95LatencyMs == null ? '--' : endpoint.p95LatencyMs + ' ms') +
          ', tokens ' + (endpoint.totalTokens || 0) +
          ', estimated cost ' + (endpoint.estimatedCostUsd == null ? 'not configured' : formatMoney(endpoint.estimatedCostUsd));
      });
      const errorItems = (metrics.recentErrors || []).map(function (entry) {
        return (entry.createdAt || 'Unknown time') + ' - ' + (entry.endpoint || 'unknown endpoint') +
          ': ' + (entry.errorMessage || 'Unspecified error');
      });
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Operations</span>' +
          '<div class="summary-title">AI Reliability and Performance</div>' +
          '<div class="summary-subtitle">Provider: ' + escapeHtml(ai.provider || 'unknown') +
            ' - Model: ' + escapeHtml(ai.model || 'unknown') +
            ' - Timeout: ' + escapeHtml(ai.timeoutMs || '--') + ' ms' +
            ' - Lookback: ' + escapeHtml(metrics.periodDays || 30) + ' days</div>' +
        '</div>' +
        '<div class="metric-row">' +
          '<div class="metric"><div class="metric-label">Requests</div><div class="metric-value">' + escapeHtml(overall.requestCount || 0) + '</div></div>' +
          '<div class="metric"><div class="metric-label">Success Rate</div><div class="metric-value">' +
            escapeHtml(overall.successRate == null ? '--' : overall.successRate + '%') + '</div></div>' +
          '<div class="metric"><div class="metric-label">Average Latency</div><div class="metric-value">' +
            escapeHtml(overall.averageLatencyMs == null ? '--' : overall.averageLatencyMs + ' ms') + '</div></div>' +
          '<div class="metric"><div class="metric-label">P95 Latency</div><div class="metric-value">' +
            escapeHtml(overall.p95LatencyMs == null ? '--' : overall.p95LatencyMs + ' ms') + '</div></div>' +
          '<div class="metric"><div class="metric-label">Total Tokens</div><div class="metric-value">' +
            escapeHtml(overall.totalTokens || 0) + '</div></div>' +
          '<div class="metric"><div class="metric-label">Estimated Cost</div><div class="metric-value">' +
            escapeHtml(overall.estimatedCostUsd == null ? 'Not configured' : formatMoney(overall.estimatedCostUsd)) + '</div></div>' +
        '</div>' +
        '<div class="grid">' +
          '<div class="content-card"><h3>Endpoint Performance</h3>' + listItems(endpointItems) + '</div>' +
          '<div class="content-card"><h3>Recent Errors</h3>' + listItems(errorItems) + '</div>' +
        '</div>' +
        renderDebug(data);
    }
    function renderRecommendationReview(data) {
      const insights = data.insights || [];
      const cards = insights.map(function (insight) {
        return '<div class="content-card">' +
          '<span class="badge">Pending Review</span>' +
          '<h3>' + escapeHtml(insight.title || insight.insightType || 'AI Recommendation') + '</h3>' +
          '<p>' + escapeHtml(insight.summary || 'No summary provided.') + '</p>' +
          '<div class="summary-subtitle">Account: ' + escapeHtml(insight.accountNumber || '--') +
            ' - Confidence: ' + escapeHtml(insight.confidence || 'unknown') +
            ' - Generated by: ' + escapeHtml(insight.generatedBy || 'unknown') + '</div>' +
          '<div class="actions" style="margin-top:12px">' +
            '<button class="primary" data-review-id="' + escapeHtml(insight.id) + '" data-review-status="approved" onclick="reviewRecommendation(this.dataset.reviewId, this.dataset.reviewStatus)">Approve</button>' +
            '<button data-review-id="' + escapeHtml(insight.id) + '" data-review-status="rejected" onclick="reviewRecommendation(this.dataset.reviewId, this.dataset.reviewStatus)">Reject</button>' +
          '</div>' +
        '</div>';
      }).join('');
      result.innerHTML =
        '<div class="summary-hero">' +
          '<span class="badge">AI Governance</span>' +
          '<div class="summary-title">Recommendation Review</div>' +
          '<div class="summary-subtitle">' + escapeHtml(insights.length) +
            ' AI recommendation' + (insights.length === 1 ? '' : 's') + ' awaiting supervisor review.</div>' +
        '</div>' +
        (cards || '<div class="empty-result">No AI recommendations are waiting for review.</div>');
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
    async function loadAiOperations() {
      try {
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '30');
        renderAiOperations(await requestJson('/api/ai/operations?periodDays=' + encodeURIComponent(periodDays)));
      } catch (error) { setError(error); }
    }
    async function loadRecommendationReview() {
      try {
        renderRecommendationReview(await requestJson('/api/account-intelligence/insights/review-queue'));
      } catch (error) { setError(error); }
    }
    async function reviewRecommendation(insightId, status) {
      try {
        await requestJson('/api/account-intelligence/insights/' + encodeURIComponent(insightId) + '/review', {
          method: 'PUT',
          body: JSON.stringify({ status })
        });
        await loadRecommendationReview();
      } catch (error) { setError(error); }
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
    async function forecastProductDemand() {
      try {
        const fallbackAccountNumber = document.getElementById('accountNumber').value.trim();
        const accountNumber = document.getElementById('aiAccountNumber').value.trim() || fallbackAccountNumber;
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        renderProductDemandForecast(await requestJson('/api/ai/product-demand-forecast', {
          method: 'POST',
          body: JSON.stringify({
            accountNumber,
            routeDate: document.getElementById('aiRouteDate').value,
            periodDays
          })
        }));
      } catch (error) { setError(error); }
    }
    async function predictRouteCompletion() {
      try {
        renderRouteCompletionPrediction(await requestJson('/api/ai/route-completion-prediction', {
          method: 'POST',
          body: JSON.stringify({
            routeDate: document.getElementById('aiRouteDate').value
          })
        }));
      } catch (error) { setError(error); }
    }
    async function analyzeOperationalHeatmap() {
      try {
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '30');
        renderOperationalHeatmap(await requestJson('/api/ai/operational-heatmap', {
          method: 'POST',
          body: JSON.stringify({
            routeDate: document.getElementById('aiRouteDate').value,
            periodDays
          })
        }));
      } catch (error) { setError(error); }
    }
    async function analyzeDriverCoaching() {
      try {
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '30');
        renderDriverCoaching(await requestJson('/api/ai/driver-coaching', {
          method: 'POST',
          body: JSON.stringify({
            driverId: document.getElementById('aiDriverId').value.trim(),
            routeDate: document.getElementById('aiRouteDate').value,
            periodDays
          })
        }));
      } catch (error) { setError(error); }
    }
    async function reconstructIncident() {
      try {
        renderIncidentReconstruction(await requestJson('/api/ai/incident-reconstruction', {
          method: 'POST',
          body: JSON.stringify({
            routeSessionId: document.getElementById('aiRouteSessionId').value.trim()
          })
        }));
      } catch (error) { setError(error); }
    }
    async function runWhatIfSimulation() {
      try {
        const fallbackAccountNumber = document.getElementById('accountNumber').value.trim();
        const accountNumber = document.getElementById('aiAccountNumber').value.trim() || fallbackAccountNumber;
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        renderWhatIfSimulation(await requestJson('/api/ai/what-if-simulation', {
          method: 'POST',
          body: JSON.stringify({
            scenario: document.getElementById('aiQuestion').value.trim(),
            accountNumber,
            routeDate: document.getElementById('aiRouteDate').value,
            periodDays
          })
        }));
      } catch (error) { setError(error); }
    }
    async function analyzeKnowledgeGraph() {
      try {
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        renderKnowledgeGraph(await requestJson('/api/ai/knowledge-graph-insights', {
          method: 'POST',
          body: JSON.stringify({
            routeDate: document.getElementById('aiRouteDate').value,
            periodDays
          })
        }));
      } catch (error) { setError(error); }
    }
    async function generateUnifiedDashboard() {
      try {
        const fallbackAccountNumber = document.getElementById('accountNumber').value.trim();
        const accountNumber = document.getElementById('aiAccountNumber').value.trim() || fallbackAccountNumber;
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '30');
        renderUnifiedDashboard(await requestJson('/api/ai/unified-intelligence-dashboard', {
          method: 'POST',
          body: JSON.stringify({
            accountNumber,
            routeDate: document.getElementById('aiRouteDate').value,
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
    async function predictDeliveryFailure() {
      try {
        const fallbackAccountNumber = document.getElementById('accountNumber').value.trim();
        const accountNumber = document.getElementById('aiAccountNumber').value.trim() || fallbackAccountNumber;
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        renderDeliveryFailureRisk(await requestJson('/api/ai/delivery-failure-risk', {
          method: 'POST',
          body: JSON.stringify({
            accountNumber,
            routeDate: document.getElementById('aiRouteDate').value,
            periodDays
          })
        }));
      } catch (error) { setError(error); }
    }
    async function predictDeductionRisk() {
      try {
        const fallbackAccountNumber = document.getElementById('accountNumber').value.trim();
        const accountNumber = document.getElementById('aiAccountNumber').value.trim() || fallbackAccountNumber;
        const periodDays = Number(document.getElementById('periodDays').value.trim() || '180');
        renderDeductionRisk(await requestJson('/api/ai/deduction-risk', {
          method: 'POST',
          body: JSON.stringify({
            accountNumber,
            routeDate: document.getElementById('aiRouteDate').value,
            periodDays
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

router.get('/insights/review-queue', requireAdminSession, async (req, res) => {
  try {
    const insights = await repositories.listAccountInsights({
      status: 'pending_review',
      limit: req.query?.limit || 100
    });
    return res.json({ insights });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.get('/insights/admin', requireAdminSession, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderSupervisorIntelligenceQueue(req.adminSession));
});

router.get('/insights', requireAdminSession, async (req, res) => {
  try {
    const insights = await repositories.listAccountInsights({
      accountNumber: cleanText(req.query?.accountNumber || req.query?.account_number, 120) || undefined,
      insightType: cleanText(req.query?.insightType || req.query?.insight_type, 120) || undefined,
      status: cleanText(req.query?.status, 80) || 'pending_review',
      limit: req.query?.limit || 200
    });
    return res.json({ insights: insights.map(insightWithPriority) });
  } catch (error) {
    return handleRouteError(res, error);
  }
});

router.put('/insights/:id/review', requireAdminSession, async (req, res) => {
  try {
    const insight = await repositories.reviewAccountInsight(req.params.id, {
      ...(req.body || {}),
      reviewedBy: req.adminSession?.username || 'supervisor'
    });
    return res.json({ insight });
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
