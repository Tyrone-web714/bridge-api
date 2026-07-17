const crypto = require('crypto');
const express = require('express');
const adminAuth = require('../services/adminAuth');
const auditLog = require('../services/auditLog');
const authorization = require('../middleware/authorization');
const logisticsIntelligence = require('../services/logisticsIntelligence');
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
    .update(`${session.username || 'anonymous'}:${session.sessionVersion ?? 'legacy'}:${session.expiresAt || ''}:logistics-intelligence`)
    .digest('base64url');
}

function sendError(req, res, error, fallback) {
  const status = error.status || 500;
  if (status >= 500) console.error(`[logistics-intelligence] ${error.stack || error.message}`);
  return res.status(status).json({
    error: error.message || fallback,
    code: error.code || 'LOGISTICS_INTELLIGENCE_ERROR'
  });
}

function requireJsonMutation(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const contentType = String(req.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Logistics Intelligence mutations require application/json.', code: 'INVALID_CONTENT_TYPE' });
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
      eventType: 'logistics_intelligence_csrf_denial',
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
    return res.status(403).type('html').send(renderAccessDeniedPage('Organization context is required for Logistics Intelligence.'));
  }
  if (!rbac.hasPermission(req.authContext, rbac.PERMISSIONS.INTELLIGENCE_VIEW)) {
    return res.status(403).type('html').send(renderAccessDeniedPage('You do not have permission to view Logistics Intelligence.'));
  }
  return next();
}

function renderAdminPage(session = {}) {
  const csrf = csrfTokenForSession(session);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Logistics Intelligence Foundation</title>
  <style>
    :root{color-scheme:dark;--bg:#071018;--panel:rgba(255,255,255,.08);--line:rgba(255,255,255,.16);--text:#f3fbff;--muted:#a9bdc7;--cyan:#19d3e6;--green:#4ade80;--gold:#fbbf24;--red:#f87171}
    *{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:var(--bg);color:var(--text)}
    header{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:22px 28px;border-bottom:1px solid var(--line);background:linear-gradient(110deg,rgba(25,211,230,.14),rgba(251,191,36,.12))}
    h1{margin:0;font-size:32px}p{color:var(--muted);line-height:1.45}a,button{font:inherit}
    .pill,button{border:1px solid var(--line);border-radius:8px;padding:10px 12px;color:var(--text);background:rgba(255,255,255,.08);font-weight:900;text-decoration:none;cursor:pointer}
    button.primary{background:var(--cyan);color:#061019;border:0}.danger{border-color:var(--red)}.ok{color:var(--green)}.warn{color:var(--gold)}
    main{display:grid;grid-template-columns:330px 1fr;min-height:calc(100vh - 91px)}aside{border-right:1px solid var(--line);padding:18px;background:rgba(255,255,255,.04)}
    section{padding:18px}.card{border:1px solid var(--line);border-radius:8px;background:var(--panel);padding:14px;margin-bottom:12px}
    label{display:grid;gap:6px;color:var(--muted);font-size:12px;font-weight:900;margin-top:10px}input,select,textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:10px;background:#102536;color:var(--text);font:inherit}textarea{min-height:72px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.meta{color:var(--muted);font-size:12px}
    pre{white-space:pre-wrap;max-height:360px;overflow:auto;background:#061019;border:1px solid var(--line);border-radius:8px;padding:12px}
  </style>
</head>
<body>
  <header><div><h1>Logistics Intelligence Foundation</h1><p>Organization-scoped events, signals, findings, recommendations, decisions, outcomes, and explainability lineage.</p></div><a class="pill" href="/api/admin">Dashboard</a></header>
  <main>
    <aside>
      <div class="card"><strong>${escapeHtml(session.displayName || session.username || 'user')}</strong><div class="meta">${escapeHtml(session.approvedRole || session.role || '')}</div></div>
      <button class="primary" onclick="loadAll()">Refresh</button>
      <button onclick="seedSample()">Create Sample Event</button>
      <button onclick="runPipeline()">Run Pipeline</button>
      <div id="status" class="meta" style="margin-top:12px"></div>
    </aside>
    <section>
      <div class="grid">
        <div class="card"><h2>Events</h2><div id="events"></div></div>
        <div class="card"><h2>Signals</h2><div id="signals"></div></div>
        <div class="card"><h2>Findings</h2><div id="findings"></div></div>
        <div class="card"><h2>Recommendations</h2><div id="recommendations"></div></div>
      </div>
      <div class="card">
        <h2>Decision Center Detail</h2>
        <div id="detail"><p class="meta">Open a recommendation to inspect rationale, lineage, decisions, and outcomes.</p></div>
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
    function card(title,meta,body=''){return '<div class="card"><strong>'+esc(title)+'</strong><div class="meta">'+esc(meta)+'</div>'+body+'</div>'}
    async function loadAll(){
      const [events,signals,findings,recommendations]=await Promise.all([
        request('/api/logistics-intelligence/events'),
        request('/api/logistics-intelligence/signals'),
        request('/api/logistics-intelligence/findings'),
        request('/api/logistics-intelligence/recommendations')
      ]);
      $('events').innerHTML=events.events.map(e=>card(e.eventType,e.subjectType+' '+e.subjectId+' · '+e.status)).join('')||'<p class="meta">No events yet.</p>';
      $('signals').innerHTML=signals.signals.map(s=>card(s.signalType,s.severity+' · '+s.status+' · '+s.detectedAt)).join('')||'<p class="meta">No signals yet.</p>';
      $('findings').innerHTML=findings.findings.map(f=>card(f.title,f.severity+' · '+f.status)).join('')||'<p class="meta">No findings yet.</p>';
      $('recommendations').innerHTML=recommendations.recommendations.map(r=>card(r.recommendationType,r.priority+' · '+r.status,'<p>'+esc(r.recommendation)+'</p><button onclick="openRecommendation(\\''+esc(r.id)+'\\')">Open</button>')).join('')||'<p class="meta">No recommendations yet.</p>';
      msg('Loaded.');
    }
    async function seedSample(){
      await request('/api/logistics-intelligence/events',{method:'POST',body:JSON.stringify({eventType:'route_delay',eventCategory:'route_execution',sourceType:'admin_sample',subjectType:'route',subjectId:'demo-route',routeId:'demo-route',occurredAt:new Date().toISOString(),idempotencyKey:'sample-route-delay-'+new Date().toISOString().slice(0,13),payload:{delayMinutes:42,severity:'high'}})});
      msg('Sample event created.'); await loadAll();
    }
    async function runPipeline(){await request('/api/logistics-intelligence/process',{method:'POST',body:JSON.stringify({limit:50})}); await loadAll();}
    async function openRecommendation(id){
      const data=await request('/api/logistics-intelligence/recommendations/'+encodeURIComponent(id));
      $('detail').innerHTML='<pre>'+esc(JSON.stringify(data.recommendation,null,2))+'</pre><button onclick="decide(\\''+esc(id)+'\\',\\'marked_reviewed\\')">Mark Reviewed</button><button onclick="recordOutcome(\\''+esc(id)+'\\')">Record Outcome</button>';
    }
    async function decide(id,decision){await request('/api/logistics-intelligence/recommendations/'+encodeURIComponent(id)+'/decisions',{method:'POST',body:JSON.stringify({decision,reason:'Reviewed in foundation decision center.'})}); await loadAll();}
    async function recordOutcome(id){await request('/api/logistics-intelligence/recommendations/'+encodeURIComponent(id)+'/outcomes',{method:'POST',body:JSON.stringify({outcomeType:'manual_review',result:'recorded',effectiveness:.5,notes:'Foundation outcome recorded.'})}); await openRecommendation(id);}
    loadAll().catch(error=>msg(error.message));
  </script>
</body>
</html>`;
}

router.get('/admin', requireAdminPage, (req, res) => {
  res.type('html').send(renderAdminPage(req.adminSession));
});

router.get('/catalog', authorization.requirePermission(rbac.PERMISSIONS.INTELLIGENCE_VIEW), (req, res) => {
  res.json({
    engineVersion: logisticsIntelligence.ENGINE_VERSION,
    eventCatalog: logisticsIntelligence.EVENT_CATALOG
  });
});

router.post('/events', authorization.requirePermission(rbac.PERMISSIONS.INTELLIGENCE_MANAGE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const event = await logisticsIntelligence.ingestEvent(req.authContext, req.body || {});
    auditLog.recordSecurityEvent(req, { eventType: 'logistics_event_ingested', statusCode: 201, metadata: { eventId: event.id, eventType: event.eventType } }).catch(() => {});
    return res.status(201).json({ event });
  } catch (error) {
    return sendError(req, res, error, 'Unable to ingest logistics event.');
  }
});

router.get('/events', authorization.requirePermission(rbac.PERMISSIONS.INTELLIGENCE_VIEW), async (req, res) => {
  try {
    const events = await logisticsIntelligence.listEvents(req.authContext, req.query || {});
    return res.json({ events });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list logistics events.');
  }
});

router.post('/signals/run', authorization.requirePermission(rbac.PERMISSIONS.INTELLIGENCE_REVIEW), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const signals = await logisticsIntelligence.runSignalDetection(req.authContext, req.body || {});
    return res.status(201).json({ signals });
  } catch (error) {
    return sendError(req, res, error, 'Unable to run signal detection.');
  }
});

router.post('/process', authorization.requirePermission(rbac.PERMISSIONS.INTELLIGENCE_REVIEW), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const result = await logisticsIntelligence.processIntelligence(req.authContext, req.body || {});
    auditLog.recordSecurityEvent(req, { eventType: 'logistics_intelligence_processed', statusCode: 201 }).catch(() => {});
    return res.status(201).json(result);
  } catch (error) {
    return sendError(req, res, error, 'Unable to process logistics intelligence.');
  }
});

router.get('/signals', authorization.requirePermission(rbac.PERMISSIONS.INTELLIGENCE_VIEW), async (req, res) => {
  try {
    const signals = await logisticsIntelligence.listSignals(req.authContext, req.query || {});
    return res.json({ signals });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list logistics signals.');
  }
});

router.get('/findings', authorization.requirePermission(rbac.PERMISSIONS.INTELLIGENCE_VIEW), async (req, res) => {
  try {
    const findings = await logisticsIntelligence.listFindings(req.authContext, req.query || {});
    return res.json({ findings });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list logistics findings.');
  }
});

router.get('/recommendations', authorization.requirePermission(rbac.PERMISSIONS.RECOMMENDATION_VIEW), async (req, res) => {
  try {
    const recommendations = await logisticsIntelligence.listRecommendations(req.authContext, req.query || {});
    return res.json({ recommendations });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list logistics recommendations.');
  }
});

router.get('/recommendations/:id', authorization.requirePermission(rbac.PERMISSIONS.RECOMMENDATION_VIEW), async (req, res) => {
  try {
    const recommendation = await logisticsIntelligence.getRecommendation(req.authContext, req.params.id);
    return res.json({ recommendation });
  } catch (error) {
    return sendError(req, res, error, 'Unable to load logistics recommendation.');
  }
});

router.post('/recommendations/:id/decisions', authorization.requirePermission(rbac.PERMISSIONS.RECOMMENDATION_DECIDE), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const decision = await logisticsIntelligence.decideRecommendation(req.authContext, req.params.id, req.body || {});
    auditLog.recordSecurityEvent(req, { eventType: 'logistics_recommendation_decided', statusCode: 201, metadata: { recommendationId: req.params.id, decision: decision.decision } }).catch(() => {});
    return res.status(201).json({ decision });
  } catch (error) {
    return sendError(req, res, error, 'Unable to decide logistics recommendation.');
  }
});

router.post('/recommendations/:id/outcomes', authorization.requirePermission(rbac.PERMISSIONS.OUTCOME_RECORD), requireJsonMutation, requireAdminCsrfIfCookie, async (req, res) => {
  try {
    const outcome = await logisticsIntelligence.recordOutcome(req.authContext, req.params.id, req.body || {});
    auditLog.recordSecurityEvent(req, { eventType: 'logistics_outcome_recorded', statusCode: 201, metadata: { recommendationId: req.params.id, outcomeId: outcome.id } }).catch(() => {});
    return res.status(201).json({ outcome });
  } catch (error) {
    return sendError(req, res, error, 'Unable to record logistics outcome.');
  }
});

router.get('/outcomes', authorization.requirePermission(rbac.PERMISSIONS.INTELLIGENCE_VIEW), async (req, res) => {
  try {
    const outcomes = await logisticsIntelligence.listOutcomes(req.authContext, req.query || {});
    return res.json({ outcomes });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list logistics outcomes.');
  }
});

module.exports = router;
