const express = require('express');
const adminAuth = require('../services/adminAuth');
const repositories = require('../db/repositories');

const router = express.Router();

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function requireAdminSession(req, res, next) {
  const session = adminAuth.getAdminSession(req);
  if (!session) {
    if (req.accepts('html')) return res.redirect('/api/routing/manual-hazards/admin/login');
    return res.status(401).json({ ok: false, error: 'Supervisor admin login required.' });
  }
  req.adminSession = session;
  return next();
}

function requireRegionalAdmin(req, res, next) {
  const role = cleanText(req.adminSession?.role, 40).toLowerCase();
  if (!['admin', 'regional_admin', 'regional'].includes(role)) {
    return res.status(403).json({
      ok: false,
      error: 'Regional administrator access is required to change operational geography.'
    });
  }
  return next();
}

function renderOperationalGeographyPage(session) {
  const username = cleanText(session?.username || 'supervisor', 80);
  const role = cleanText(session?.role || 'supervisor', 40);
  const canEdit = ['admin', 'regional_admin', 'regional'].includes(role.toLowerCase());
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truck-Safe Operational Geography</title>
  <style>
    :root {
      color-scheme: dark;
      --bg:#061019; --panel:rgba(255,255,255,.075); --line:rgba(255,255,255,.16);
      --text:#f3fbff; --muted:#a9bdc7; --cyan:#19d3e6; --green:#62f2a0; --red:#ff5964;
    }
    * { box-sizing:border-box; }
    body {
      margin:0; min-height:100vh; font-family:Arial,sans-serif; color:var(--text);
      background:linear-gradient(145deg,#061019,#0c2735 62%,#18090e);
    }
    header { padding:26px clamp(18px,4vw,48px); border-bottom:1px solid var(--line); }
    h1 { margin:0; font-size:clamp(30px,4vw,48px); }
    h2 { margin:0 0 8px; }
    p { color:var(--muted); line-height:1.45; }
    main { padding:22px clamp(18px,4vw,48px) 50px; display:grid; gap:22px; }
    .topline,.actions { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    .tabs { display:flex; gap:9px; flex-wrap:wrap; }
    .tab,button {
      border:1px solid var(--line); border-radius:10px; padding:10px 14px;
      color:var(--text); background:rgba(255,255,255,.09); font-weight:900;
      text-decoration:none; cursor:pointer;
    }
    button.primary { color:#03151c; background:var(--cyan); border:0; }
    button.danger { background:rgba(217,33,46,.78); }
    button.green { color:#03130b; background:var(--green); border:0; }
    .section { border-top:1px solid var(--line); padding-top:20px; }
    .form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; }
    label { display:grid; gap:6px; color:#aeeef7; font-size:12px; font-weight:900; text-transform:uppercase; }
    input,select,textarea {
      width:100%; border:1px solid #31596a; border-radius:10px; padding:11px;
      color:#fff; background:#071720; font:inherit;
    }
    select option { color:#fff; background:#102536; }
    textarea { min-height:88px; resize:vertical; }
    table { width:100%; border-collapse:collapse; margin-top:14px; }
    th,td { padding:10px; border-bottom:1px solid rgba(255,255,255,.12); text-align:left; vertical-align:top; }
    th { color:#82f5ff; font-size:11px; text-transform:uppercase; }
    .muted { color:var(--muted); }
    .status-active { color:var(--green); font-weight:900; }
    .status-inactive { color:#ff9198; font-weight:900; }
    .message { min-height:22px; color:var(--green); font-weight:900; }
    .readonly { padding:11px 13px; border-left:4px solid var(--cyan); background:rgba(25,211,230,.09); }
    @media(max-width:760px) { table { display:block; overflow-x:auto; } }
  </style>
</head>
<body>
  <header>
    <div class="topline">
      <div>
        <h1>Operational Geography</h1>
        <p>Define the company hierarchy used by heatmaps, route assignment, driver teams, and future regional intelligence.</p>
      </div>
      <strong>${username} - ${role}</strong>
    </div>
  </header>
  <main>
    <nav class="tabs">
      <a class="tab" href="/api/admin">Dashboard</a>
      <a class="tab" href="/api/operational-heatmaps/admin">Heatmaps</a>
      <a class="tab" href="/api/drivers/admin">Driver Registry</a>
      <a class="tab" href="/api/route-manifests/admin">Route Manifests</a>
    </nav>
    ${canEdit ? '' : '<div class="readonly">This page is read-only for supervisors. A regional administrator controls geography definitions.</div>'}

    <section class="section">
      <h2>Distribution Centers</h2>
      <p>Warehouses or depots where routes originate.</p>
      ${canEdit ? `
      <div class="form-grid">
        <label>Center Code<input id="centerCode" placeholder="SAN_ANTONIO_DC" /></label>
        <label>Center Name<input id="centerName" placeholder="San Antonio DC" /></label>
        <label>Address<input id="centerAddress" /></label>
        <label>City<input id="centerCity" /></label>
        <label>State<select id="centerState"><option value="">Select</option><option>TX</option><option>OK</option><option>NM</option><option>AR</option></select></label>
        <label>Latitude<input id="centerLatitude" inputmode="decimal" /></label>
        <label>Longitude<input id="centerLongitude" inputmode="decimal" /></label>
      </div>
      <p><button class="primary" onclick="saveCenter()">Save Distribution Center</button></p>` : ''}
      <div id="centers"></div>
    </section>

    <section class="section">
      <h2>Territories</h2>
      <p>Operational areas containing one or more states and cities.</p>
      ${canEdit ? `
      <div class="form-grid">
        <label>Territory Code<input id="territoryCode" placeholder="SAN_ANTONIO" /></label>
        <label>Territory Name<input id="territoryName" placeholder="San Antonio" /></label>
        <label>Distribution Center<select id="territoryCenter"><option value="">None</option></select></label>
        <label>State Codes<input id="territoryStates" placeholder="TX" /></label>
      </div>
      <label>Cities, separated by commas<textarea id="territoryCities" placeholder="San Antonio, Leon Valley, Converse"></textarea></label>
      <p><button class="primary" onclick="saveTerritory()">Save Territory</button></p>` : ''}
      <div id="territories"></div>
    </section>

    <section class="section">
      <h2>Route Groups</h2>
      <p>Supervisor-managed route teams within a territory and distribution center.</p>
      ${canEdit ? `
      <div class="form-grid">
        <label>Route Group Code<input id="groupCode" placeholder="SA_NORTH" /></label>
        <label>Route Group Name<input id="groupName" placeholder="San Antonio North" /></label>
        <label>Territory<select id="groupTerritory"><option value="">None</option></select></label>
        <label>Distribution Center<select id="groupCenter"><option value="">None</option></select></label>
      </div>
      <p><button class="primary" onclick="saveRouteGroup()">Save Route Group</button></p>` : ''}
      <div id="routeGroups"></div>
    </section>
    <div id="message" class="message"></div>
  </main>
  <script>
    const canEdit = ${canEdit ? 'true' : 'false'};
    let geography = { distributionCenters: [], territories: [], routeGroups: [] };
    function escapeHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function value(id) { return document.getElementById(id)?.value.trim() || ''; }
    function setMessage(text, error) {
      const message = document.getElementById('message');
      message.textContent = text;
      message.style.color = error ? '#ff9198' : '#62f2a0';
    }
    function optionHtml(items, selected) {
      return '<option value="">None</option>' + items.map(item =>
        '<option value="' + escapeHtml(item.code) + '"' + (item.code === selected ? ' selected' : '') + '>' +
        escapeHtml(item.name) + '</option>'
      ).join('');
    }
    async function request(url, options) {
      const response = await fetch(url, options);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Request failed.');
      return body;
    }
    function actionButton(type, item) {
      if (!canEdit) return '';
      const next = !item.active;
      return '<button class="' + (next ? 'green' : 'danger') + '" onclick="setActive(\\'' +
        type + '\\',\\'' + encodeURIComponent(item.code) + '\\',' + next + ')">' +
        (next ? 'Reactivate' : 'Deactivate') + '</button>';
    }
    function render() {
      if (canEdit) {
        document.getElementById('territoryCenter').innerHTML = optionHtml(geography.distributionCenters);
        document.getElementById('groupCenter').innerHTML = optionHtml(geography.distributionCenters);
        document.getElementById('groupTerritory').innerHTML = optionHtml(geography.territories);
      }
      document.getElementById('centers').innerHTML =
        '<table><thead><tr><th>Center</th><th>Location</th><th>Status</th><th></th></tr></thead><tbody>' +
        geography.distributionCenters.map(item => '<tr><td><strong>' + escapeHtml(item.name) +
          '</strong><br><span class="muted">' + escapeHtml(item.code) + '</span></td><td>' +
          escapeHtml([item.address,item.city,item.stateCode].filter(Boolean).join(', ') || 'Not recorded') +
          '</td><td class="' + (item.active ? 'status-active' : 'status-inactive') + '">' +
          (item.active ? 'Active' : 'Inactive') + '</td><td>' + actionButton('distribution_center', item) + '</td></tr>').join('') +
        '</tbody></table>';
      document.getElementById('territories').innerHTML =
        '<table><thead><tr><th>Territory</th><th>Center</th><th>States / Cities</th><th>Status</th><th></th></tr></thead><tbody>' +
        geography.territories.map(item => '<tr><td><strong>' + escapeHtml(item.name) +
          '</strong><br><span class="muted">' + escapeHtml(item.code) + '</span></td><td>' +
          escapeHtml(item.distributionCenterCode || '-') + '</td><td>' +
          escapeHtml((item.stateCodes || []).join(', ') || '-') + '<br><span class="muted">' +
          escapeHtml((item.cities || []).join(', ') || 'No cities assigned') + '</span></td><td class="' +
          (item.active ? 'status-active' : 'status-inactive') + '">' + (item.active ? 'Active' : 'Inactive') +
          '</td><td>' + actionButton('territory', item) + '</td></tr>').join('') +
        '</tbody></table>';
      document.getElementById('routeGroups').innerHTML =
        '<table><thead><tr><th>Route Group</th><th>Territory</th><th>Center</th><th>Status</th><th></th></tr></thead><tbody>' +
        geography.routeGroups.map(item => '<tr><td><strong>' + escapeHtml(item.name) +
          '</strong><br><span class="muted">' + escapeHtml(item.code) + '</span></td><td>' +
          escapeHtml(item.territoryCode || '-') + '</td><td>' +
          escapeHtml(item.distributionCenterCode || '-') + '</td><td class="' +
          (item.active ? 'status-active' : 'status-inactive') + '">' + (item.active ? 'Active' : 'Inactive') +
          '</td><td>' + actionButton('route_group', item) + '</td></tr>').join('') +
        '</tbody></table>';
    }
    async function loadGeography() {
      const body = await request('/api/operational-geography/data?includeInactive=true');
      geography = body.geography;
      render();
    }
    async function saveCenter() {
      try {
        await request('/api/operational-geography/distribution-centers', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({code:value('centerCode'),name:value('centerName'),address:value('centerAddress'),
            city:value('centerCity'),stateCode:value('centerState'),latitude:value('centerLatitude'),longitude:value('centerLongitude')})
        });
        setMessage('Distribution center saved.');
        await loadGeography();
      } catch (error) { setMessage(error.message, true); }
    }
    async function saveTerritory() {
      try {
        await request('/api/operational-geography/territories', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({code:value('territoryCode'),name:value('territoryName'),
            distributionCenterCode:value('territoryCenter'),stateCodes:value('territoryStates'),cities:value('territoryCities')})
        });
        setMessage('Territory saved.');
        await loadGeography();
      } catch (error) { setMessage(error.message, true); }
    }
    async function saveRouteGroup() {
      try {
        await request('/api/operational-geography/route-groups', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({code:value('groupCode'),name:value('groupName'),
            territoryCode:value('groupTerritory'),distributionCenterCode:value('groupCenter')})
        });
        setMessage('Route group saved.');
        await loadGeography();
      } catch (error) { setMessage(error.message, true); }
    }
    async function setActive(type, encodedCode, active) {
      try {
        await request('/api/operational-geography/' + type + '/' + encodedCode + '/active', {
          method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({active})
        });
        setMessage('Operational geography status updated.');
        await loadGeography();
      } catch (error) { setMessage(error.message, true); }
    }
    loadGeography().catch(error => setMessage(error.message, true));
  </script>
</body>
</html>`;
}

router.get('/admin', requireAdminSession, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderOperationalGeographyPage(req.adminSession));
});

router.get('/data', requireAdminSession, async (req, res) => {
  try {
    const geography = await repositories.listOperationalGeographyConfiguration({
      includeInactive: req.query.includeInactive === 'true'
    });
    return res.json({ ok: true, geography });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Unable to load operational geography.' });
  }
});

router.post('/distribution-centers', requireAdminSession, requireRegionalAdmin, async (req, res) => {
  try {
    const distributionCenter = await repositories.upsertOperationalDistributionCenter(
      req.body || {},
      req.adminSession.username
    );
    return res.json({ ok: true, distributionCenter });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Unable to save distribution center.' });
  }
});

router.post('/territories', requireAdminSession, requireRegionalAdmin, async (req, res) => {
  try {
    const territory = await repositories.upsertOperationalTerritory(req.body || {}, req.adminSession.username);
    return res.json({ ok: true, territory });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Unable to save territory.' });
  }
});

router.post('/route-groups', requireAdminSession, requireRegionalAdmin, async (req, res) => {
  try {
    const routeGroup = await repositories.upsertOperationalRouteGroup(req.body || {}, req.adminSession.username);
    return res.json({ ok: true, routeGroup });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Unable to save route group.' });
  }
});

router.put('/:entityType/:code/active', requireAdminSession, requireRegionalAdmin, async (req, res) => {
  try {
    const updated = await repositories.setOperationalGeographyActive(
      req.params.entityType,
      req.params.code,
      req.body?.active === true,
      req.adminSession.username
    );
    if (!updated) return res.status(404).json({ ok: false, error: 'Operational geography record not found.' });
    return res.json({ ok: true, updated });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Unable to update geography status.' });
  }
});

module.exports = router;
