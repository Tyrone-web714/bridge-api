const crypto = require('crypto');
const express = require('express');
const adminAuth = require('../services/adminAuth');
const auditLog = require('../services/auditLog');
const authorization = require('../middleware/authorization');
const biKpi = require('../services/biKpi');
const rbac = require('../services/rbac');

const router = express.Router();

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function csrfTokenForSession(session = {}) {
  const secret = adminAuth.getAdminSecret() || 'missing-admin-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${session.username || 'anonymous'}:${session.sessionVersion ?? 'legacy'}:${session.expiresAt || ''}:bi-kpi`)
    .digest('base64url');
}

function sendError(req, res, error, fallback) {
  const status = error.status || 500;
  if (status >= 500) console.error(`[bi-kpi] ${error.stack || error.message}`);
  return res.status(status).json({
    error: error.message || fallback,
    code: error.code || 'BI_KPI_ERROR'
  });
}

function requireJsonMutation(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const contentType = String(req.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return res.status(415).json({ error: 'BI/KPI mutations require application/json.', code: 'INVALID_CONTENT_TYPE' });
    }
  }
  return next();
}

function requireAdminCsrfIfCookie(req, res, next) {
  req.authContext = authorization.buildAuthContext(req);
  if (req.authContext.actorType !== 'admin_user') return next();
  const session = req.adminSession || adminAuth.getAdminSession(req) || {};
  const expected = csrfTokenForSession(session);
  const presented = String(req.get('x-tsr-admin-csrf') || '');
  if (!presented || presented !== expected) {
    auditLog.recordSecurityEvent(req, {
      eventType: 'bi_kpi_csrf_denial',
      statusCode: 403,
      code: 'CSRF_TOKEN_INVALID'
    }).catch(() => {});
    return res.status(403).json({ error: 'Invalid admin action token.', code: 'CSRF_TOKEN_INVALID' });
  }
  return next();
}

function requireAdminPage(req, res, next) {
  const session = adminAuth.getAdminSession(req);
  if (!session) return res.redirect('/api/routing/manual-hazards/admin/login');
  req.adminSession = session;
  req.authContext = authorization.buildAuthContext(req);
  if (!req.authContext.organizationId) {
    return res.status(403).type('html').send(renderAccessDeniedPage('Organization context is required for Organization-private BI/KPI dashboards.'));
  }
  if (!rbac.hasPermission(req.authContext, rbac.PERMISSIONS.DASHBOARD_VIEW)) {
    return res.status(403).type('html').send(renderAccessDeniedPage('You do not have permission to view BI/KPI dashboards.'));
  }
  return next();
}

function renderAccessDeniedPage(message) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Access Denied</title><style>
    body{font-family:Arial,sans-serif;background:#061019;color:#f3fbff;margin:0;display:grid;place-items:center;min-height:100vh}
    .box{max-width:620px;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:28px;background:rgba(255,255,255,.08)}
    a{color:#19d3e6;font-weight:900}
  </style></head><body><div class="box"><h1>Access Denied</h1><p>${escapeHtml(message)}</p><a href="/api/admin">Return to dashboard</a></div></body></html>`;
}

function renderAdminPage(session = {}) {
  const csrf = csrfTokenForSession(session);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BI/KPI Foundation</title>
  <style>
    :root{color-scheme:dark;--bg:#061019;--panel:rgba(255,255,255,.08);--line:rgba(255,255,255,.16);--text:#f3fbff;--muted:#a9bdc7;--cyan:#19d3e6;--green:#4ade80;--gold:#fbbf24;--red:#f87171}
    *{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:var(--bg);color:var(--text)}
    header{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:22px 28px;border-bottom:1px solid var(--line);background:linear-gradient(110deg,rgba(25,211,230,.16),rgba(74,222,128,.12))}
    h1{margin:0;font-size:34px}p{color:var(--muted);line-height:1.45}a,button{font:inherit}
    .pill,button{border:1px solid var(--line);border-radius:8px;padding:10px 12px;color:var(--text);background:rgba(255,255,255,.08);font-weight:900;text-decoration:none;cursor:pointer}
    button.primary{background:var(--cyan);color:#061019;border:0}.danger{border-color:var(--red)}.ok{color:var(--green)}.warn{color:var(--gold)}
    main{display:grid;grid-template-columns:330px 1fr;min-height:calc(100vh - 93px)}aside{border-right:1px solid var(--line);padding:18px;background:rgba(255,255,255,.04)}
    section{padding:18px}.card{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:14px;margin-bottom:12px}
    label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:900;margin-top:10px}input,select,textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:10px;background:#102536;color:var(--text);font:inherit}textarea{min-height:72px}
    table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid var(--line);text-align:left;padding:9px;font-size:13px}th{color:var(--muted)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.meta{color:var(--muted);font-size:12px}
  </style>
</head>
<body>
  <header><div><h1>BI/KPI Foundation</h1><p>Organization-scoped KPI definitions, versioned formulas, deterministic snapshots, dashboards, alerts, and bounded exports.</p></div><a class="pill" href="/api/admin">Dashboard</a></header>
  <main>
    <aside>
      <div class="card"><strong>${escapeHtml(session.displayName || session.username || 'user')}</strong><div class="meta">${escapeHtml(session.approvedRole || session.role || '')}</div></div>
      <button class="primary" onclick="loadAll()">Refresh</button>
      <button onclick="seedSample()">Create Sample KPI</button>
      <a class="pill" href="/api/bi-kpi/export.csv">Export CSV</a>
      <div id="status" class="meta" style="margin-top:12px"></div>
    </aside>
    <section>
      <div class="grid">
        <div class="card"><h2>KPI Catalog</h2><div id="kpis"></div></div>
        <div class="card"><h2>Dashboards</h2><div id="dashboards"></div></div>
        <div class="card"><h2>Latest Snapshots</h2><div id="snapshots"></div></div>
        <div class="card"><h2>Alerts</h2><div id="alerts"></div></div>
      </div>
      <div class="card">
        <h2>Snapshot Drill-Down</h2>
        <div id="drilldown"><p class="meta">Open a snapshot to see formula version, raw inputs, trace, threshold, and lineage.</p></div>
      </div>
    </section>
  </main>
  <script>
    const csrfToken=${JSON.stringify(csrf)};
    const $=id=>document.getElementById(id);
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    async function request(url,options={}){
      const response=await fetch(url,{...options,headers:{'Content-Type':'application/json','x-tsr-admin-csrf':csrfToken,...(options.headers||{})}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error||'Request failed');
      return data;
    }
    function msg(text){$('status').textContent=text}
    async function loadAll(){
      const [kpis,dashboards,snapshots,alerts]=await Promise.all([
        request('/api/bi-kpi/definitions'),
        request('/api/bi-kpi/dashboards'),
        request('/api/bi-kpi/snapshots?limit=20'),
        request('/api/bi-kpi/alerts?status=')
      ]);
      $('kpis').innerHTML=kpis.kpiDefinitions.map(k=>'<div class="card"><strong>'+esc(k.name)+'</strong><div class="meta">'+esc(k.key)+' · '+esc(k.status)+' · '+esc(k.unit)+'</div><button onclick="calculateSample(\\''+esc(k.id)+'\\')">Calculate</button></div>').join('')||'<p class="meta">No KPI definitions yet.</p>';
      $('dashboards').innerHTML=dashboards.dashboards.map(d=>'<div class="card"><strong>'+esc(d.name)+'</strong><div class="meta">'+esc(d.audiencePermission)+'</div></div>').join('')||'<p class="meta">No dashboards yet.</p>';
      $('snapshots').innerHTML=snapshots.snapshots.map(s=>'<div class="card"><strong>'+esc(s.calculatedValue)+' '+esc(s.thresholdStatus)+'</strong><div class="meta">'+esc(s.subjectType)+' '+esc(s.subjectId)+' · '+esc(s.calculatedAt)+'</div><button onclick="openSnapshot(\\''+esc(s.id)+'\\')">Drill down</button></div>').join('')||'<p class="meta">No snapshots yet.</p>';
      $('alerts').innerHTML=alerts.alerts.map(a=>'<div class="card"><strong>'+esc(a.severity)+' · '+esc(a.status)+'</strong><p>'+esc(a.message)+'</p></div>').join('')||'<p class="meta">No KPI alerts.</p>';
      msg('Loaded.');
    }
    async function seedSample(){
      const created=await request('/api/bi-kpi/definitions',{method:'POST',body:JSON.stringify({key:'route_completion_percentage',name:'Route Completion Percentage',category:'route_completion',unit:'percent',direction:'higher_is_better',status:'active'})});
      await request('/api/bi-kpi/definitions/'+encodeURIComponent(created.kpiDefinition.id)+'/formulas',{method:'POST',body:JSON.stringify({status:'active',expression:{op:'percentage',numerator:{op:'input',name:'completed_stops'},denominator:{op:'input',name:'planned_stops'},onZero:'zero'},inputDefinitions:[{name:'completed_stops',unit:'count'},{name:'planned_stops',unit:'count'}],thresholds:{good:95,warning:80,critical:60},roundingRules:{decimals:2}})});
      await request('/api/bi-kpi/dashboards',{method:'POST',body:JSON.stringify({name:'Operations KPI Dashboard',description:'Foundation dashboard for KPI cards.'})});
      msg('Sample KPI and dashboard created.'); await loadAll();
    }
    async function calculateSample(id){
      await request('/api/bi-kpi/definitions/'+encodeURIComponent(id)+'/calculate',{method:'POST',body:JSON.stringify({subjectType:'route',subjectId:'demo-route',inputs:{completed_stops:9,planned_stops:10},periodStart:new Date(Date.now()-86400000).toISOString(),periodEnd:new Date().toISOString()})});
      await loadAll();
    }
    async function openSnapshot(id){
      const data=await request('/api/bi-kpi/snapshots/'+encodeURIComponent(id));
      $('drilldown').innerHTML='<pre>'+esc(JSON.stringify(data.snapshot,null,2))+'</pre>';
    }
    loadAll().catch(error=>msg(error.message));
  </script>
</body>
</html>`;
}

router.get('/admin', requireAdminPage, (req, res) => {
  res.type('html').send(renderAdminPage(req.adminSession));
});

router.get('/catalog', authorization.requirePermission(rbac.PERMISSIONS.KPI_VIEW), (req, res) => {
  res.json({ kpiFamilies: biKpi.KPI_FAMILIES });
});

router.get('/definitions', authorization.requirePermission(rbac.PERMISSIONS.KPI_VIEW), async (req, res) => {
  try {
    const kpiDefinitions = await biKpi.listKpiDefinitions(req.authContext, req.query || {});
    return res.json({ kpiDefinitions });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list KPI definitions.');
  }
});

router.post('/definitions', authorization.requirePermission(rbac.PERMISSIONS.KPI_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const kpiDefinition = await biKpi.createKpiDefinition(req.authContext, req.body || {});
    auditLog.recordSecurityEvent(req, { eventType: 'kpi_definition_created', statusCode: 201, metadata: { kpiDefinitionId: kpiDefinition.id } }).catch(() => {});
    return res.status(201).json({ kpiDefinition });
  } catch (error) {
    return sendError(req, res, error, 'Unable to create KPI definition.');
  }
});

router.get('/definitions/:id', authorization.requirePermission(rbac.PERMISSIONS.KPI_VIEW), async (req, res) => {
  try {
    const kpiDefinition = await biKpi.getKpiDefinition(req.authContext, req.params.id);
    const formulaVersions = await biKpi.listFormulaVersions(req.authContext, req.params.id);
    return res.json({ kpiDefinition, formulaVersions });
  } catch (error) {
    return sendError(req, res, error, 'Unable to load KPI definition.');
  }
});

router.post('/definitions/:id/formulas', authorization.requirePermission(rbac.PERMISSIONS.KPI_FORMULA_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const formulaVersion = await biKpi.createFormulaVersion(req.authContext, req.params.id, req.body || {});
    auditLog.recordSecurityEvent(req, { eventType: 'kpi_formula_version_created', statusCode: 201, metadata: { kpiDefinitionId: req.params.id, formulaVersionId: formulaVersion.id } }).catch(() => {});
    return res.status(201).json({ formulaVersion });
  } catch (error) {
    return sendError(req, res, error, 'Unable to create formula version.');
  }
});

router.post('/definitions/:id/calculate', authorization.requirePermission(rbac.PERMISSIONS.KPI_CALCULATE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const snapshot = await biKpi.calculateKpi(req.authContext, req.params.id, req.body || {});
    auditLog.recordSecurityEvent(req, { eventType: 'kpi_snapshot_calculated', statusCode: 201, metadata: { kpiDefinitionId: req.params.id, snapshotId: snapshot.id } }).catch(() => {});
    return res.status(201).json({ snapshot });
  } catch (error) {
    return sendError(req, res, error, 'Unable to calculate KPI.');
  }
});

router.get('/snapshots', authorization.requirePermission(rbac.PERMISSIONS.KPI_SNAPSHOT_VIEW), async (req, res) => {
  try {
    const snapshots = await biKpi.listSnapshots(req.authContext, req.query || {});
    return res.json({ snapshots });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list KPI snapshots.');
  }
});

router.get('/snapshots/:id', authorization.requirePermission(rbac.PERMISSIONS.KPI_SNAPSHOT_VIEW), async (req, res) => {
  try {
    const snapshot = await biKpi.getSnapshot(req.authContext, req.params.id);
    return res.json({ snapshot });
  } catch (error) {
    return sendError(req, res, error, 'Unable to load KPI snapshot.');
  }
});

router.get('/dashboards', authorization.requirePermission(rbac.PERMISSIONS.DASHBOARD_VIEW), async (req, res) => {
  try {
    const dashboards = await biKpi.listDashboards(req.authContext, req.query || {});
    return res.json({ dashboards });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list dashboards.');
  }
});

router.post('/dashboards', authorization.requirePermission(rbac.PERMISSIONS.DASHBOARD_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const dashboard = await biKpi.createDashboard(req.authContext, req.body || {});
    auditLog.recordSecurityEvent(req, { eventType: 'bi_dashboard_created', statusCode: 201, metadata: { dashboardId: dashboard.id } }).catch(() => {});
    return res.status(201).json({ dashboard });
  } catch (error) {
    return sendError(req, res, error, 'Unable to create dashboard.');
  }
});

router.get('/dashboards/:id', authorization.requirePermission(rbac.PERMISSIONS.DASHBOARD_VIEW), async (req, res) => {
  try {
    const dashboard = await biKpi.getDashboard(req.authContext, req.params.id);
    return res.json({ dashboard });
  } catch (error) {
    return sendError(req, res, error, 'Unable to load dashboard.');
  }
});

router.post('/dashboards/:id/widgets', authorization.requirePermission(rbac.PERMISSIONS.DASHBOARD_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const widget = await biKpi.addDashboardWidget(req.authContext, req.params.id, req.body || {});
    return res.status(201).json({ widget });
  } catch (error) {
    return sendError(req, res, error, 'Unable to add dashboard widget.');
  }
});

router.post('/alerts/rules', authorization.requirePermission(rbac.PERMISSIONS.KPI_ALERT_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const alertRule = await biKpi.createAlertRule(req.authContext, req.body || {});
    return res.status(201).json({ alertRule });
  } catch (error) {
    return sendError(req, res, error, 'Unable to create KPI alert rule.');
  }
});

router.get('/alerts', authorization.requirePermission(rbac.PERMISSIONS.KPI_VIEW), async (req, res) => {
  try {
    const alerts = await biKpi.listAlerts(req.authContext, req.query || {});
    return res.json({ alerts });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list KPI alerts.');
  }
});

router.get('/export.csv', authorization.requirePermission(rbac.PERMISSIONS.DASHBOARD_EXPORT), async (req, res) => {
  try {
    const csv = await biKpi.exportSnapshotsCsv(req.authContext, req.query || {});
    const exportedAt = new Date().toISOString().slice(0, 10);
    auditLog.recordSecurityEvent(req, { eventType: 'bi_kpi_export_csv', statusCode: 200 }).catch(() => {});
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="truck-safe-kpi-snapshots-${exportedAt}.csv"`);
    return res.send(csv);
  } catch (error) {
    return sendError(req, res, error, 'Unable to export KPI snapshots.');
  }
});

module.exports = router;
