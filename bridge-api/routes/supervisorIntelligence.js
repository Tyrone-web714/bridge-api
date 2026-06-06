const express = require('express');
const adminAuth = require('../services/adminAuth');
const repositories = require('../db/repositories');
const supervisorIntelligence = require('../services/supervisorIntelligence');

const router = express.Router();

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function requireAdminSession(req, res, next) {
  const session = adminAuth.getAdminSession(req);
  if (!session) {
    if (req.path === '/admin') return res.redirect('/api/routing/manual-hazards/admin/login');
    return res.status(401).json({ ok: false, error: 'Supervisor admin login required.' });
  }
  req.adminSession = session;
  return next();
}

function isRegionalAdmin(session) {
  return ['admin', 'regional_admin', 'regional'].includes(
    cleanText(session?.role, 40).toLowerCase()
  );
}

function visibleSupervisor(session) {
  return isRegionalAdmin(session) ? null : cleanText(session?.username, 120).toLowerCase();
}

function renderPage(session) {
  const username = cleanText(session?.username || 'supervisor', 120);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Supervisor Alerts and Reports</title>
  <style>
    :root{color-scheme:dark;--bg:#06131d;--panel:#102936;--line:#315160;--text:#f5fbff;--muted:#a9bdc7;--cyan:#21d4e6;--red:#ff5964;--amber:#ffbf3f;--green:#65e69a}
    *{box-sizing:border-box} body{margin:0;background:linear-gradient(145deg,#06131d,#0d2430 62%,#18090d);color:var(--text);font:15px Arial,sans-serif}
    header{padding:26px 5vw 18px;border-bottom:1px solid var(--line);background:rgba(4,16,24,.88);position:sticky;top:0;z-index:2}
    h1{margin:0 0 8px;font-size:30px} h2{margin:0 0 14px} p{color:var(--muted)}
    main{width:min(1180px,92vw);margin:24px auto 60px;display:grid;gap:20px}
    section{background:rgba(16,41,54,.9);border:1px solid var(--line);padding:20px;border-radius:8px}
    .toolbar,.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
    button,input,select{border:1px solid var(--line);background:#071b26;color:var(--text);padding:11px 13px;border-radius:6px}
    button{cursor:pointer;font-weight:700}.primary{background:#0b7180;border-color:var(--cyan)}.danger{background:#6f222b;border-color:var(--red)}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:14px;margin-top:14px}
    .card{padding:16px;border:1px solid var(--line);border-left:5px solid var(--cyan);background:rgba(3,17,25,.72);border-radius:6px}
    .critical,.high{border-left-color:var(--red)}.medium{border-left-color:var(--amber)}.low{border-left-color:var(--green)}
    .badge{display:inline-block;padding:4px 8px;border-radius:4px;background:#173c4b;color:#d9faff;margin:0 5px 7px 0;font-size:12px;text-transform:uppercase}
    .meta{font-size:12px;color:var(--muted);margin:8px 0}.summary{font-size:17px;line-height:1.45}
    ul{padding-left:20px;color:#dcebf1}.status{min-height:20px;color:var(--cyan);font-weight:700}
    @media(max-width:600px){header{padding:20px}h1{font-size:24px}}
  </style>
</head>
<body>
  <header>
    <h1>Supervisor Alerts and Scheduled Reports</h1>
    <p>Signed in as ${username}. Rules detect exceptions; AI may summarize them, but operational records remain the source of truth.</p>
    <div class="toolbar"><button onclick="location.href='/api/admin'">Dashboard</button><button class="primary" onclick="refreshAll()">Refresh</button></div>
  </header>
  <main>
    <section>
      <h2>Alert Queue</h2>
      <div class="toolbar">
        <select id="alertStatus" onchange="loadAlerts()"><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option><option value="">All</option></select>
      </div>
      <div id="alerts" class="grid"></div>
    </section>
    <section>
      <h2>Report Schedule</h2>
      <p>The default report runs daily in the configured local timezone. Run Now queues a report for the backend worker.</p>
      <div id="schedules" class="grid"></div>
    </section>
    <section>
      <h2>Generated Reports</h2>
      <div id="reports" class="grid"></div>
    </section>
    <div id="status" class="status"></div>
  </main>
  <script>
    const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const formatDate=value=>value?new Date(value).toLocaleString():'--';
    async function request(url,options){
      const response=await fetch(url,options);
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||('HTTP '+response.status));
      return data;
    }
    async function loadAlerts(){
      const status=document.getElementById('alertStatus').value;
      const data=await request('/api/supervisor-intelligence/alerts?status='+encodeURIComponent(status));
      document.getElementById('alerts').innerHTML=data.alerts.length?data.alerts.map(alert=>
        '<article class="card '+escapeHtml(alert.severity)+'"><span class="badge">'+escapeHtml(alert.severity)+'</span><span class="badge">'+escapeHtml(alert.status)+'</span>'+
        '<h3>'+escapeHtml(alert.title)+'</h3><div class="summary">'+escapeHtml(alert.message)+'</div>'+
        '<div class="meta">'+escapeHtml(alert.alertType)+' · '+escapeHtml(formatDate(alert.lastDetectedAt))+'</div>'+
        '<div class="actions">'+(alert.canManage&&alert.status==='open'?'<button onclick="setAlert(\\''+escapeHtml(alert.id)+'\\',\\'acknowledged\\')">Acknowledge</button>':'')+
        (alert.canManage&&alert.status!=='resolved'?'<button class="primary" onclick="setAlert(\\''+escapeHtml(alert.id)+'\\',\\'resolved\\')">Resolve</button>':'')+'</div></article>'
      ).join(''):'<p>No alerts match this status.</p>';
    }
    async function setAlert(id,status){
      await request('/api/supervisor-intelligence/alerts/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
      await loadAlerts();
    }
    async function loadSchedules(){
      const data=await request('/api/supervisor-intelligence/schedules');
      document.getElementById('schedules').innerHTML=data.schedules.map(schedule=>
        '<article class="card"><span class="badge">'+(schedule.enabled?'enabled':'paused')+'</span><h3>'+escapeHtml(schedule.name)+'</h3>'+
        '<div class="summary">Daily at '+escapeHtml(String(schedule.localHour).padStart(2,'0'))+':00 '+escapeHtml(schedule.timezone)+'</div>'+
        '<div class="meta">Next: '+escapeHtml(formatDate(schedule.nextRunAt))+'<br>Last: '+escapeHtml(formatDate(schedule.lastRunAt))+'</div>'+
        '<div class="actions"><button class="primary" onclick="runNow(\\''+escapeHtml(schedule.id)+'\\')">Run Now</button>'+
        (schedule.canManage?'<button onclick="toggleSchedule(\\''+escapeHtml(schedule.id)+'\\','+(!schedule.enabled)+')">'+(schedule.enabled?'Pause':'Enable')+'</button>':'')+'</div></article>'
      ).join('');
    }
    async function runNow(id){
      document.getElementById('status').textContent='Generating report...';
      await request('/api/supervisor-intelligence/schedules/'+encodeURIComponent(id)+'/run',{method:'POST'});
      document.getElementById('status').textContent='Report generated.';
      await refreshAll();
    }
    async function toggleSchedule(id,enabled){
      await request('/api/supervisor-intelligence/schedules/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})});
      await loadSchedules();
    }
    function list(title,items){return Array.isArray(items)&&items.length?'<h4>'+escapeHtml(title)+'</h4><ul>'+items.map(item=>'<li>'+escapeHtml(item)+'</li>').join('')+'</ul>':''}
    async function loadReports(){
      const data=await request('/api/supervisor-intelligence/reports');
      document.getElementById('reports').innerHTML=data.reports.length?data.reports.map(report=>
        '<article class="card '+(report.status==='failed'?'high':'')+'"><span class="badge">'+escapeHtml(report.status)+'</span><h3>'+escapeHtml(report.title)+'</h3>'+
        '<div class="summary">'+escapeHtml(report.summary)+'</div><div class="meta">'+escapeHtml(report.generatedBy)+' · '+escapeHtml(formatDate(report.generatedAt))+'</div>'+
        list('Priorities',report.content.priorities)+list('Recommended Actions',report.content.recommendedActions)+list('Missing Data',report.content.missingData)+'</article>'
      ).join(''):'<p>No scheduled reports have been generated yet.</p>';
    }
    async function refreshAll(){
      document.getElementById('status').textContent='';
      try{await Promise.all([loadAlerts(),loadSchedules(),loadReports()]);}
      catch(error){document.getElementById('status').textContent=error.message;}
    }
    refreshAll();
  </script>
</body>
</html>`;
}

router.get('/admin', requireAdminSession, (req, res) => {
  res.type('html').send(renderPage(req.adminSession));
});

router.get('/alerts', requireAdminSession, async (req, res) => {
  try {
    const alerts = await repositories.listSupervisorAlerts({
      status: cleanText(req.query.status, 40) || undefined,
      severity: cleanText(req.query.severity, 40) || undefined,
      supervisorUsername: visibleSupervisor(req.adminSession),
      limit: req.query.limit
    });
    const regionalAdmin = isRegionalAdmin(req.adminSession);
    const username = cleanText(req.adminSession.username, 120).toLowerCase();
    return res.json({
      ok: true,
      alerts: alerts.map((alert) => ({
        ...alert,
        canManage: regionalAdmin || alert.supervisorUsername === username
      }))
    });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

router.patch('/alerts/:id', requireAdminSession, async (req, res) => {
  try {
    const visibleAlerts = await repositories.listSupervisorAlerts({
      supervisorUsername: visibleSupervisor(req.adminSession),
      limit: 500
    });
    const target = visibleAlerts.find((alert) => alert.id === req.params.id);
    const username = cleanText(req.adminSession.username, 120).toLowerCase();
    if (!target || (!isRegionalAdmin(req.adminSession) && target.supervisorUsername !== username)) {
      return res.status(403).json({ ok: false, error: 'This alert is outside your supervisor scope.' });
    }
    const alert = await repositories.updateSupervisorAlertStatus(req.params.id, {
      status: req.body?.status,
      actor: req.adminSession.username
    });
    return res.json({ ok: true, alert });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

router.get('/schedules', requireAdminSession, async (req, res) => {
  try {
    await supervisorIntelligence.ensureDefaultSchedule();
    const schedules = await repositories.listScheduledReportSchedules({
      supervisorUsername: visibleSupervisor(req.adminSession)
    });
    const regionalAdmin = isRegionalAdmin(req.adminSession);
    const username = cleanText(req.adminSession.username, 120).toLowerCase();
    return res.json({
      ok: true,
      schedules: schedules.map((schedule) => ({
        ...schedule,
        canManage: regionalAdmin || schedule.supervisorUsername === username
      }))
    });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

router.post('/schedules', requireAdminSession, async (req, res) => {
  try {
    const requestedSupervisor = isRegionalAdmin(req.adminSession)
      ? cleanText(req.body?.supervisorUsername, 120).toLowerCase() || null
      : cleanText(req.adminSession.username, 120).toLowerCase();
    const schedule = await repositories.upsertScheduledReportSchedule({
      ...req.body,
      supervisorUsername: requestedSupervisor,
      createdBy: req.adminSession.username
    });
    return res.status(201).json({ ok: true, schedule });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

router.patch('/schedules/:id', requireAdminSession, async (req, res) => {
  try {
    const schedules = await repositories.listScheduledReportSchedules({
      supervisorUsername: visibleSupervisor(req.adminSession)
    });
    const target = schedules.find((schedule) => schedule.id === req.params.id);
    const username = cleanText(req.adminSession.username, 120).toLowerCase();
    if (!target || (!isRegionalAdmin(req.adminSession) && target.supervisorUsername !== username)) {
      return res.status(403).json({ ok: false, error: 'This schedule is outside your supervisor scope.' });
    }
    const schedule = await repositories.setScheduledReportScheduleEnabled(
      req.params.id,
      req.body?.enabled === true
    );
    return res.json({ ok: true, schedule });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

router.post('/schedules/:id/run', requireAdminSession, async (req, res) => {
  try {
    const schedules = await repositories.listScheduledReportSchedules({
      supervisorUsername: visibleSupervisor(req.adminSession)
    });
    const schedule = schedules.find((candidate) => candidate.id === req.params.id);
    if (!schedule) return res.status(404).json({ ok: false, error: 'Scheduled report definition not found.' });
    const result = await supervisorIntelligence.runSchedule(schedule, {
      routeDate: cleanText(req.body?.routeDate, 40) || undefined
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

router.get('/reports', requireAdminSession, async (req, res) => {
  try {
    const reports = await repositories.listScheduledReports({
      supervisorUsername: visibleSupervisor(req.adminSession),
      limit: req.query.limit
    });
    return res.json({ ok: true, reports });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
