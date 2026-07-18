const crypto = require('crypto');
const express = require('express');
const adminAuth = require('../services/adminAuth');
const auditLog = require('../services/auditLog');
const authorization = require('../middleware/authorization');
const fiss = require('../services/fleetIntelligenceScoring');
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
    .update(`${session.username || 'anonymous'}:${session.sessionVersion ?? 'legacy'}:${session.expiresAt || ''}:fleet-intelligence-scoring`)
    .digest('base64url');
}

function sendError(req, res, error, fallback) {
  const status = error.status || 500;
  if (status >= 500) console.error(`[fleet-intelligence-scoring] ${error.stack || error.message}`);
  return res.status(status).json({
    error: error.message || fallback,
    code: error.code || 'FLEET_INTELLIGENCE_SCORE_ERROR'
  });
}

function requireJsonMutation(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const contentType = String(req.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Fleet score mutations require application/json.', code: 'INVALID_CONTENT_TYPE' });
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
      eventType: 'fleet_score_csrf_denial',
      statusCode: 403,
      code: 'CSRF_TOKEN_INVALID'
    }).catch(() => {});
    return res.status(403).json({ error: 'Invalid admin action token.', code: 'CSRF_TOKEN_INVALID' });
  }
  return next();
}

function renderAccessDeniedPage(message) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Access Denied</title><style>
    body{font-family:Arial,sans-serif;background:#071018;color:#f3fbff;margin:0;display:grid;place-items:center;min-height:100vh}
    .box{max-width:620px;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:28px;background:rgba(255,255,255,.08)}
    a{color:#19d3e6;font-weight:900}
  </style></head><body><div class="box"><h1>Access Denied</h1><p>${escapeHtml(message)}</p><a href="/api/admin">Return to dashboard</a></div></body></html>`;
}

function requireAdminPage(req, res, next) {
  const session = adminAuth.getAdminSession(req);
  if (!session) return res.redirect('/api/routing/manual-hazards/admin/login');
  req.adminSession = session;
  req.authContext = authorization.buildAuthContext(req);
  if (!req.authContext.organizationId) {
    return res.status(403).type('html').send(renderAccessDeniedPage('Organization context is required for Fleet Intelligence Scoring.'));
  }
  if (!rbac.hasPermission(req.authContext, rbac.PERMISSIONS.FLEET_SCORE_VIEW)) {
    return res.status(403).type('html').send(renderAccessDeniedPage('You do not have permission to view Fleet Intelligence scores.'));
  }
  return next();
}

function renderAdminPage(session = {}) {
  const csrf = csrfTokenForSession(session);
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fleet Intelligence Scoring Foundation</title>
<style>
:root{color-scheme:dark;--bg:#071018;--panel:rgba(255,255,255,.08);--line:rgba(255,255,255,.16);--text:#f3fbff;--muted:#a9bdc7;--cyan:#19d3e6;--green:#4ade80;--gold:#fbbf24}
*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:var(--bg);color:var(--text)}
header{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:22px 28px;border-bottom:1px solid var(--line);background:linear-gradient(110deg,rgba(74,222,128,.14),rgba(25,211,230,.12))}
h1{margin:0;font-size:32px}p{color:var(--muted);line-height:1.45}a,button{font:inherit}
.pill,button{border:1px solid var(--line);border-radius:8px;padding:10px 12px;color:var(--text);background:rgba(255,255,255,.08);font-weight:900;text-decoration:none;cursor:pointer}
button.primary{background:var(--cyan);color:#061019;border:0}
main{display:grid;grid-template-columns:330px 1fr;min-height:calc(100vh - 91px)}aside{border-right:1px solid var(--line);padding:18px;background:rgba(255,255,255,.04)}
section{padding:18px}.card{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:14px;margin-bottom:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}.meta{color:var(--muted);font-size:12px}pre{white-space:pre-wrap;max-height:380px;overflow:auto;background:#061019;border:1px solid var(--line);border-radius:8px;padding:12px}
</style></head>
<body>
<header><div><h1>Fleet Intelligence Scoring Foundation</h1><p>Versioned, reproducible, Organization-scoped scores from Logistics Intelligence outputs.</p></div><a class="pill" href="/api/admin">Dashboard</a></header>
<main><aside>
<div class="card"><strong>${escapeHtml(session.displayName || session.username || 'user')}</strong><div class="meta">${escapeHtml(session.approvedRole || session.role || '')}</div></div>
<button class="primary" onclick="loadAll()">Refresh</button>
<button onclick="seedModel()">Create Route Score Model</button>
<button onclick="calculateSample()">Calculate Sample Score</button>
<div id="status" class="meta" style="margin-top:12px"></div>
</aside><section>
<div class="grid"><div class="card"><h2>Models</h2><div id="models"></div></div><div class="card"><h2>Snapshots</h2><div id="snapshots"></div></div></div>
<div class="card"><h2>Score Detail</h2><div id="detail"><p class="meta">Open a score snapshot to inspect model version, components, lineage, and explanation.</p></div></div>
</section></main>
<script>
const csrfToken=${JSON.stringify(csrf)};
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let modelId=null;
async function request(url,options={}){const r=await fetch(url,{...options,headers:{'Content-Type':'application/json','x-tsr-admin-csrf':csrfToken,...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Request failed');return d}
function msg(t){$('status').textContent=t}
function card(title,meta,body=''){return '<div class="card"><strong>'+esc(title)+'</strong><div class="meta">'+esc(meta)+'</div>'+body+'</div>'}
async function loadAll(){const [models,snapshots]=await Promise.all([request('/api/fleet-intelligence-scoring/models'),request('/api/fleet-intelligence-scoring/snapshots')]);modelId=models.models[0]?.id||modelId;$('models').innerHTML=models.models.map(m=>card(m.name,m.subjectType+' · '+m.status)).join('')||'<p class="meta">No score models yet.</p>';$('snapshots').innerHTML=snapshots.snapshots.map(s=>card(s.scoreValue+' · '+s.scoreBand,s.subjectType+' '+s.subjectId+' · '+s.calculatedAt,'<button onclick="openSnapshot(\\''+esc(s.id)+'\\')">Open</button>')).join('')||'<p class="meta">No score snapshots yet.</p>';msg('Loaded.')}
async function seedModel(){const created=await request('/api/fleet-intelligence-scoring/models',{method:'POST',body:JSON.stringify({scoreKey:'route_foundation_score',name:'Route Foundation Score',subjectType:'route',status:'active'})});modelId=created.model.id;await request('/api/fleet-intelligence-scoring/models/'+encodeURIComponent(modelId)+'/versions',{method:'POST',body:JSON.stringify({status:'active',componentWeights:{safety:.25,efficiency:.25,reliability:.2,risk:.15,compliance:.05,performance:.1},formulaNotes:'Foundation weighted component score.'})});await loadAll()}
async function calculateSample(){if(!modelId)await seedModel();await request('/api/fleet-intelligence-scoring/models/'+encodeURIComponent(modelId)+'/calculate',{method:'POST',body:JSON.stringify({subjectType:'route',subjectId:'demo-route',periodStart:new Date(Date.now()-86400000).toISOString(),periodEnd:new Date().toISOString()})});await loadAll()}
async function openSnapshot(id){const data=await request('/api/fleet-intelligence-scoring/snapshots/'+encodeURIComponent(id));$('detail').innerHTML='<pre>'+esc(JSON.stringify(data.snapshot,null,2))+'</pre>'}
loadAll().catch(e=>msg(e.message));
</script></body></html>`;
}

router.get('/admin', requireAdminPage, (req, res) => res.type('html').send(renderAdminPage(req.adminSession)));

router.get('/catalog', authorization.requirePermission(rbac.PERMISSIONS.FLEET_SCORE_VIEW), (req, res) => {
  res.json({ engineVersion: fiss.ENGINE_VERSION, subjectTypes: fiss.SUBJECT_TYPES, defaultComponentWeights: fiss.DEFAULT_COMPONENT_WEIGHTS });
});

router.get('/models', authorization.requirePermission(rbac.PERMISSIONS.FLEET_SCORE_VIEW), async (req, res) => {
  try {
    const models = await fiss.listScoreModels(req.authContext, req.query || {});
    return res.json({ models });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list score models.');
  }
});

router.post('/models', authorization.requirePermission(rbac.PERMISSIONS.FLEET_SCORE_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const model = await fiss.createScoreModel(req.authContext, req.body || {});
    auditLog.recordSecurityEvent(req, { eventType: 'fleet_score_model_created', statusCode: 201, metadata: { modelId: model.id } }).catch(() => {});
    return res.status(201).json({ model });
  } catch (error) {
    return sendError(req, res, error, 'Unable to create score model.');
  }
});

router.get('/models/:id', authorization.requirePermission(rbac.PERMISSIONS.FLEET_SCORE_VIEW), async (req, res) => {
  try {
    const model = await fiss.getScoreModel(req.authContext, req.params.id);
    const versions = await fiss.listModelVersions(req.authContext, req.params.id);
    return res.json({ model, versions });
  } catch (error) {
    return sendError(req, res, error, 'Unable to load score model.');
  }
});

router.post('/models/:id/versions', authorization.requirePermission(rbac.PERMISSIONS.FLEET_SCORE_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const version = await fiss.createModelVersion(req.authContext, req.params.id, req.body || {});
    return res.status(201).json({ version });
  } catch (error) {
    return sendError(req, res, error, 'Unable to create score model version.');
  }
});

router.post('/models/:id/calculate', authorization.requirePermission(rbac.PERMISSIONS.FLEET_SCORE_CALCULATE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const snapshot = await fiss.calculateScore(req.authContext, req.params.id, req.body || {});
    auditLog.recordSecurityEvent(req, { eventType: 'fleet_score_calculated', statusCode: 201, metadata: { modelId: req.params.id, snapshotId: snapshot.id } }).catch(() => {});
    return res.status(201).json({ snapshot });
  } catch (error) {
    return sendError(req, res, error, 'Unable to calculate score.');
  }
});

router.get('/snapshots', authorization.requirePermission(rbac.PERMISSIONS.FLEET_SCORE_VIEW), async (req, res) => {
  try {
    const snapshots = await fiss.listScoreSnapshots(req.authContext, req.query || {});
    return res.json({ snapshots });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list score snapshots.');
  }
});

router.get('/snapshots/:id', authorization.requirePermission(rbac.PERMISSIONS.FLEET_SCORE_VIEW), async (req, res) => {
  try {
    const snapshot = await fiss.getScoreSnapshot(req.authContext, req.params.id);
    return res.json({ snapshot });
  } catch (error) {
    return sendError(req, res, error, 'Unable to load score snapshot.');
  }
});

router.post('/benchmarks', authorization.requirePermission(rbac.PERMISSIONS.FLEET_SCORE_BENCHMARK), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const benchmark = await fiss.createBenchmarkSet(req.authContext, req.body || {});
    return res.status(201).json({ benchmark });
  } catch (error) {
    return sendError(req, res, error, 'Unable to create benchmark set.');
  }
});

module.exports = router;
