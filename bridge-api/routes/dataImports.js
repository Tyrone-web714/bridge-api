const express = require('express');
const adminAuth = require('../services/adminAuth');
const bulkImport = require('../services/bulkImport');
const repositories = require('../db/repositories');

const router = express.Router();

function requireAdminSession(req, res, next) {
  const session = adminAuth.getAdminSession(req);
  if (!session) return res.status(401).json({ error: 'Admin login required.' });
  req.adminSession = session;
  return next();
}

const TEMPLATES = {
  customers: [
    'account_number,account_name,address,city,state,zip,phone,territory,route_group,distribution_center,active',
    'ACCT-1001,Northside Market,100 Demo Market Way,San Antonio,TX,78249,,San Antonio North,North Routes,San Antonio DC,true',
  ].join('\r\n'),
  products: [
    'sku,barcodes,product_name,brand,package_size,category,unit_price,active',
    'COLA-12PK-12OZ,000000000101|000000000102,Cola 12 oz 12 Pack,Demo Beverage,12 Pack,Sparkling,8.75,true',
  ].join('\r\n'),
  orders: [
    'account_number,account_name,invoice_number,order_date,delivery_date,sku,product_name,brand,package_size,category,quantity,unit_price,gross_amount,deduction_quantity,deduction_amount,status',
    'ACCT-1001,Northside Market,INV-1001,2026-06-05,2026-06-06,COLA-12PK-12OZ,Cola 12 oz 12 Pack,Demo Beverage,12 Pack,Sparkling,36,8.75,315,0,0,planned',
  ].join('\r\n'),
};

function renderAdminPage() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Production Data Imports</title>
  <style>
    :root { color-scheme: dark; --bg:#061019; --panel:#102532; --line:rgba(255,255,255,.16); --text:#f4fbff; --muted:#a9bdc7; --cyan:#4ddbea; --red:#d9212e; --green:#65e69a; --amber:#ffbf3f; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Arial,sans-serif; color:var(--text); background:linear-gradient(155deg,#061019,#0d2635 58%,#17090c); }
    header, main { width:min(1180px,calc(100% - 32px)); margin:auto; }
    header { padding:30px 0 18px; }
    h1 { margin:0; font-size:clamp(30px,5vw,52px); }
    .muted { color:var(--muted); line-height:1.5; }
    .nav { display:flex; gap:10px; flex-wrap:wrap; margin-top:18px; }
    .nav a, button { border:1px solid var(--line); color:var(--text); background:rgba(255,255,255,.08); padding:11px 15px; border-radius:8px; font-weight:800; text-decoration:none; cursor:pointer; }
    main { padding-bottom:48px; display:grid; gap:16px; }
    .panel { border:1px solid var(--line); border-radius:8px; padding:18px; background:rgba(16,37,50,.88); }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
    label { display:grid; gap:6px; color:var(--muted); font-size:13px; font-weight:800; }
    select,input,textarea { width:100%; border:1px solid var(--line); border-radius:8px; padding:12px; color:var(--text); background:#071722; font:inherit; }
    textarea { min-height:280px; resize:vertical; font-family:Consolas,monospace; font-size:12px; line-height:1.45; }
    button.primary { background:var(--red); }
    button.preview { background:#087f8c; }
    button:disabled { opacity:.42; cursor:not-allowed; }
    .actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
    .result { display:none; margin-top:14px; padding:14px; border-radius:8px; background:#071722; white-space:pre-wrap; line-height:1.45; }
    .result.visible { display:block; }
    .good { color:var(--green); } .warn { color:var(--amber); } .bad { color:#ff8d94; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th,td { text-align:left; padding:10px; border-bottom:1px solid var(--line); vertical-align:top; }
    th { color:var(--cyan); text-transform:uppercase; font-size:11px; }
  </style>
</head>
<body>
  <header>
    <h1>Production Data Imports</h1>
    <p class="muted">Preview and validate customer, product, invoice, and sales-line CSVs before committing them to PostgreSQL. Re-imports update existing account, SKU, and invoice records instead of creating duplicates.</p>
    <div class="nav">
      <a href="/api/admin">Supervisor Dashboard</a>
      <a href="/api/route-manifests/admin">Daily Route Imports</a>
      <a href="/api/account-intelligence/admin">Account Intelligence</a>
    </div>
  </header>
  <main>
    <section class="panel">
      <div class="grid">
        <label>Import type
          <select id="importType">
            <option value="customers">Customer master</option>
            <option value="products">Product catalog</option>
            <option value="orders">Invoices and sales lines</option>
          </select>
        </label>
        <label>Source file name<input id="fileName" placeholder="customers-2026-06-05.csv" /></label>
        <label>Choose CSV file<input id="filePicker" type="file" accept=".csv,text/csv" /></label>
      </div>
      <div class="actions">
        <button onclick="loadTemplate()">Load Template</button>
        <button class="preview" onclick="previewImport()">Preview and Validate</button>
        <button id="commitButton" class="primary" onclick="commitImport()" disabled>Commit Import</button>
      </div>
      <p class="muted">A preview is required before commit. Invalid rows are skipped and listed as warnings. Maximum rows per upload: 100,000.</p>
      <textarea id="csvText" placeholder="Choose a CSV file or paste CSV data here"></textarea>
      <div id="result" class="result"></div>
    </section>
    <section class="panel">
      <h2>Recent Import Batches</h2>
      <div id="history" class="muted">Loading...</div>
    </section>
  </main>
  <script>
    let previewSignature = '';
    const typeInput = document.getElementById('importType');
    const csvInput = document.getElementById('csvText');
    const fileInput = document.getElementById('filePicker');
    const result = document.getElementById('result');
    const commitButton = document.getElementById('commitButton');

    function escapeHtml(value) {
      return String(value == null ? '' : value)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function signature() { return typeInput.value + ':' + csvInput.value; }
    function resetPreview() { previewSignature = ''; commitButton.disabled = true; }
    typeInput.addEventListener('change', resetPreview);
    csvInput.addEventListener('input', resetPreview);
    fileInput.addEventListener('change', async function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      document.getElementById('fileName').value = file.name;
      csvInput.value = await file.text();
      resetPreview();
    });
    async function request(url, options) {
      const response = await fetch(url, options);
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
      return data;
    }
    function show(message, className) {
      result.className = 'result visible ' + (className || '');
      result.textContent = message;
    }
    async function loadTemplate() {
      const response = await fetch('/api/data-imports/templates/' + typeInput.value + '.csv');
      csvInput.value = await response.text();
      document.getElementById('fileName').value = typeInput.value + '-template.csv';
      resetPreview();
    }
    async function previewImport() {
      try {
        const data = await request('/api/data-imports/preview', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ importType:typeInput.value, csvText:csvInput.value })
        });
        previewSignature = signature();
        commitButton.disabled = data.preview.validCount < 1;
        const warningText = data.preview.warnings.length
          ? '\\n\\nWarnings:\\n' + data.preview.warnings.map(function (item) { return 'Row ' + item.row + ': ' + item.reason; }).join('\\n')
          : '';
        show('Rows: ' + data.preview.rowCount + '\\nValid records: ' + data.preview.validCount + '\\nWarnings: ' + data.preview.warningCount + warningText, data.preview.warningCount ? 'warn' : 'good');
      } catch (error) { show(error.message, 'bad'); }
    }
    async function commitImport() {
      if (previewSignature !== signature()) {
        show('The CSV changed after preview. Preview it again before commit.', 'warn');
        commitButton.disabled = true;
        return;
      }
      commitButton.disabled = true;
      try {
        const data = await request('/api/data-imports/commit', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            importType:typeInput.value,
            csvText:csvInput.value,
            fileName:document.getElementById('fileName').value
          })
        });
        show('Import complete.\\nRows: ' + data.summary.rows + '\\nImported records: ' + data.summary.imported + '\\nWarnings: ' + data.summary.warnings + '\\nBatch: ' + data.batch.id, 'good');
        loadHistory();
      } catch (error) {
        show(error.message, 'bad');
        commitButton.disabled = false;
      }
    }
    async function loadHistory() {
      try {
        const data = await request('/api/data-imports/batches?limit=25');
        document.getElementById('history').innerHTML = data.batches.length
          ? '<table><thead><tr><th>Date</th><th>Type</th><th>File</th><th>Rows</th><th>Imported</th><th>Warnings</th><th>By</th></tr></thead><tbody>' +
            data.batches.map(function (batch) {
              return '<tr><td>' + escapeHtml(new Date(batch.createdAt).toLocaleString()) + '</td><td>' + escapeHtml(batch.importType) + '</td><td>' + escapeHtml(batch.sourceFileName || '-') + '</td><td>' + batch.rowCount + '</td><td>' + batch.importedCount + '</td><td>' + batch.warningCount + '</td><td>' + escapeHtml(batch.importedBy || '-') + '</td></tr>';
            }).join('') + '</tbody></table>'
          : 'No production imports recorded yet.';
      } catch (error) { document.getElementById('history').textContent = error.message; }
    }
    loadHistory();
  </script>
</body>
</html>`;
}

router.get('/admin', (req, res) => {
  if (!adminAuth.getAdminSession(req)) {
    return res.redirect('/api/routing/manual-hazards/admin/login');
  }
  res.type('html').send(renderAdminPage());
});

router.get('/templates/:type.csv', requireAdminSession, (req, res) => {
  const template = TEMPLATES[req.params.type];
  if (!template) return res.status(404).json({ error: 'Import template not found.' });
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${req.params.type}-import-template.csv"`);
  return res.send(template);
});

router.post('/preview', requireAdminSession, (req, res) => {
  try {
    const preview = bulkImport.normalizeImport(req.body?.importType, req.body?.csvText);
    return res.json({
      ok: true,
      preview: {
        importType: preview.importType,
        rowCount: preview.rowCount,
        validCount: preview.validCount,
        warningCount: preview.warningCount,
        warnings: preview.warnings,
        sample: preview.sample,
      },
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Import preview failed.' });
  }
});

router.post('/commit', requireAdminSession, async (req, res) => {
  try {
    const preview = bulkImport.normalizeImport(req.body?.importType, req.body?.csvText);
    if (!preview.validCount) {
      return res.status(400).json({ error: 'No valid records are available to import.' });
    }
    const result = await bulkImport.executeImport(preview, {
      fileName: req.body?.fileName,
      importedBy: req.adminSession?.username,
    });
    return res.status(201).json({
      ok: true,
      summary: result.summary,
      batch: result.batch,
      warnings: preview.warnings,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Bulk import failed.' });
  }
});

router.get('/batches', requireAdminSession, async (req, res) => {
  try {
    const batches = await repositories.listDataImportBatches(req.query || {});
    return res.json({ ok: true, batches });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to list import batches.' });
  }
});

router.get('/customers', requireAdminSession, async (req, res) => {
  try {
    const customers = await repositories.listCustomerAccounts(req.query || {});
    return res.json({ ok: true, customers });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to list customer accounts.' });
  }
});

module.exports = router;
