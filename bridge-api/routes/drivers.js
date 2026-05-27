const express = require('express');
const { parse } = require('csv-parse/sync');
const adminAuth = require('../services/adminAuth');
const repositories = require('../db/repositories');

const router = express.Router();

const DRIVER_COLUMN_ALIASES = {
  driverId: ['driver_id', 'driver id', 'employee_id', 'employee id', 'id'],
  driverName: ['driver_name', 'driver name', 'name', 'employee_name', 'employee name'],
  employeeNumber: ['employee_number', 'employee number', 'employee_id_number', 'employee #', 'employee_no'],
  phoneNumber: ['phone_number', 'phone number', 'phone', 'mobile', 'assigned_phone'],
  routeGroup: ['route_group', 'route group', 'team', 'route_team', 'center', 'department'],
  territory: ['territory', 'area', 'service_area', 'service area'],
  supervisorUsername: ['supervisor_username', 'supervisor username', 'supervisor_user', 'supervisor_login'],
  supervisorName: ['supervisor_name', 'supervisor name', 'supervisor'],
  teamName: ['team_name', 'team name', 'driver_team', 'driver team'],
  active: ['active', 'status', 'enabled'],
  notes: ['notes', 'comments']
};

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeHeader(value) {
  return cleanText(value, 120).toLowerCase().replace(/[\s.-]+/g, '_');
}

function readCell(row, fieldName) {
  const aliases = DRIVER_COLUMN_ALIASES[fieldName] || [];
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    if (Object.prototype.hasOwnProperty.call(row, normalizedAlias)) {
      return row[normalizedAlias];
    }
  }
  return '';
}

function parseActive(value) {
  const cleaned = cleanText(value, 40).toLowerCase();
  if (!cleaned) return true;
  if (['false', 'inactive', 'disabled', 'no', '0'].includes(cleaned)) return false;
  return true;
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

function renderDriverRegistryAdminPage(session) {
  const adminUser = cleanText(session?.username || 'supervisor', 80);
  const adminRole = cleanText(session?.role || 'supervisor', 40);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truck-Safe Driver Registry</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07131d;
      --panel: rgba(255,255,255,0.085);
      --line: rgba(255,255,255,0.16);
      --text: #f3fbff;
      --muted: #a9bdc7;
      --red: #d9212e;
      --cyan: #19d3e6;
      --green: #62f2a0;
      --yellow: #ffbf3f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 14% 8%, rgba(217,33,46,0.22), transparent 28%),
        radial-gradient(circle at 86% 4%, rgba(25,211,230,0.22), transparent 30%),
        linear-gradient(160deg, #061019 0%, #0b2230 58%, #19080d 100%);
    }
    header { padding: 28px 34px; border-bottom: 1px solid var(--line); background: rgba(0,0,0,0.24); }
    h1 { margin: 0; font-size: 34px; line-height: 1.1; }
    h2 { margin: 0 0 12px; }
    p { color: var(--muted); line-height: 1.45; }
    main { padding: 22px 34px 48px; display: grid; gap: 18px; }
    .toprow { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
    .role-badge { border: 1px solid var(--line); border-radius: 999px; padding: 9px 12px; color: var(--muted); background: rgba(255,255,255,0.08); font-weight: 800; }
    .tabs { display: flex; gap: 10px; flex-wrap: wrap; }
    .tab, button {
      border: 0;
      border-radius: 12px;
      padding: 10px 14px;
      color: #fff;
      background: #0d6efd;
      font-weight: 900;
      text-decoration: none;
      cursor: pointer;
    }
    .tab.active { background: var(--cyan); color: #03151c; }
    button.secondary { background: rgba(255,255,255,0.12); border: 1px solid var(--line); }
    button.danger { background: rgba(217,33,46,0.88); }
    button.green { background: rgba(24,150,82,0.92); }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .panel {
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 18px;
      background: linear-gradient(180deg, rgba(255,255,255,0.105), rgba(255,255,255,0.055));
      box-shadow: 0 18px 36px rgba(0,0,0,0.22);
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
    label { display: block; margin-bottom: 6px; color: #aeeef7; font-size: 12px; font-weight: 900; text-transform: uppercase; }
    input, select, textarea {
      width: 100%;
      border-radius: 12px;
      border: 1px solid #31596a;
      background: rgba(3,11,17,0.88);
      color: #fff;
      padding: 12px;
      font: inherit;
    }
    textarea { min-height: 130px; font-family: Consolas, monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { text-align: left; border-bottom: 1px solid rgba(255,255,255,0.14); padding: 10px; vertical-align: top; }
    th { color: #82f5ff; font-size: 12px; text-transform: uppercase; }
    .muted { color: var(--muted); }
    .message { min-height: 22px; color: var(--green); font-weight: 900; }
    .status-active { color: var(--green); font-weight: 900; }
    .status-inactive { color: #ff8188; font-weight: 900; }
    .row-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  </style>
</head>
<body>
  <header>
    <div class="toprow">
      <div>
        <h1>Driver Registry</h1>
      <p>Divide drivers by supervisor/team, then use those registered driver IDs when assigning and switching daily routes.</p>
      </div>
      <div class="role-badge">${adminUser} - ${adminRole}</div>
    </div>
  </header>
  <main>
    <nav class="tabs">
      <a class="tab" href="/api/admin">Dashboard</a>
      <a class="tab" href="/api/route-manifests/admin">Route Manifests</a>
      <a class="tab active" href="/api/drivers/admin">Driver Registry</a>
      <a class="tab" href="/api/delivery-notes/admin">Delivery Notes</a>
      <a class="tab" href="/api/routing/manual-hazards/admin">Hazard Review</a>
      <a class="tab" href="/api/routing/manual-hazards/admin-users/admin">Admin Users</a>
    </nav>

    <section class="panel">
      <h2>Add or Update Driver</h2>
      <div class="grid">
        <div><label>Driver ID</label><input id="driverId" placeholder="driver_app" /></div>
        <div><label>Driver Name</label><input id="driverName" placeholder="Driver full name" /></div>
        <div><label>Employee Number</label><input id="employeeNumber" placeholder="Optional" /></div>
        <div><label>Phone Number</label><input id="phoneNumber" placeholder="Optional" /></div>
        <div><label>Supervisor Username</label><input id="supervisorUsername" placeholder="supervisor login" /></div>
        <div><label>Supervisor Name</label><input id="supervisorName" placeholder="Supervisor full name" /></div>
        <div><label>Team Name</label><input id="teamName" placeholder="Route team name" /></div>
        <div><label>Route Group</label><input id="routeGroup" placeholder="San Antonio North" /></div>
        <div><label>Territory</label><input id="territory" placeholder="San Antonio" /></div>
        <div>
          <label>Status</label>
          <select id="active">
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>
      <p><label>Notes</label><textarea id="notes" placeholder="Optional supervisor notes"></textarea></p>
      <p class="row-actions">
        <button onclick="saveDriver()">Save Driver</button>
        <button class="secondary" onclick="clearForm()">Clear</button>
      </p>
      <div id="message" class="message"></div>
    </section>

    <section class="panel">
      <h2>Bulk Import Drivers</h2>
      <p class="muted">For 100 drivers, paste or upload a CSV. Columns accepted: driver_id, driver_name, employee_number, phone_number, supervisor_username, supervisor_name, team_name, route_group, territory, active, notes.</p>
      <p class="row-actions">
        <button class="secondary" onclick="loadDriverTemplate()">Use CSV Template</button>
      </p>
      <p><input id="filePicker" type="file" accept=".csv,text/csv" /></p>
      <textarea id="csvText" placeholder="Paste driver registry CSV here"></textarea>
      <p><button class="green" onclick="importDrivers()">Import Drivers</button></p>
    </section>

    <section class="panel">
      <div class="toprow">
        <h2>Registered Drivers</h2>
        <div class="row-actions">
          <input id="search" placeholder="Search driver, employee #, group, territory" style="min-width:300px" />
          <select id="activeFilter">
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button onclick="loadDrivers()">Refresh</button>
        </div>
      </div>
      <div id="drivers"></div>
    </section>
  </main>
  <script>
    const filePicker = document.getElementById('filePicker');
    filePicker.addEventListener('change', async () => {
      const file = filePicker.files && filePicker.files[0];
      if (!file) return;
      document.getElementById('csvText').value = await file.text();
    });

    document.getElementById('search').addEventListener('input', () => {
      clearTimeout(window.__driverSearchTimer);
      window.__driverSearchTimer = setTimeout(loadDrivers, 250);
    });
    document.getElementById('activeFilter').addEventListener('change', loadDrivers);

    function escapeHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c]));
    }

    function inputValue(id) {
      return document.getElementById(id).value.trim();
    }

    function setInputValue(id, value) {
      document.getElementById(id).value = value == null ? '' : String(value);
    }

    function clearForm() {
      ['driverId','driverName','employeeNumber','phoneNumber','supervisorUsername','supervisorName','teamName','routeGroup','territory','notes'].forEach(id => setInputValue(id, ''));
      document.getElementById('active').value = 'true';
    }

    function editDriver(driver) {
      setInputValue('driverId', driver.driverId);
      setInputValue('driverName', driver.driverName);
      setInputValue('employeeNumber', driver.employeeNumber);
      setInputValue('phoneNumber', driver.phoneNumber);
      setInputValue('supervisorUsername', driver.supervisorUsername);
      setInputValue('supervisorName', driver.supervisorName);
      setInputValue('teamName', driver.teamName);
      setInputValue('routeGroup', driver.routeGroup);
      setInputValue('territory', driver.territory);
      setInputValue('notes', driver.notes);
      document.getElementById('active').value = driver.active ? 'true' : 'false';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function saveDriver() {
      const payload = {
        driverId: inputValue('driverId'),
        driverName: inputValue('driverName'),
        employeeNumber: inputValue('employeeNumber'),
        phoneNumber: inputValue('phoneNumber'),
        supervisorUsername: inputValue('supervisorUsername'),
        supervisorName: inputValue('supervisorName'),
        teamName: inputValue('teamName'),
        routeGroup: inputValue('routeGroup'),
        territory: inputValue('territory'),
        active: document.getElementById('active').value === 'true',
        notes: inputValue('notes')
      };
      const response = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      document.getElementById('message').textContent = response.ok
        ? 'Saved driver ' + data.driver.driverId + '.'
        : data.error || 'Unable to save driver.';
      if (response.ok) {
        clearForm();
        loadDrivers();
      }
    }

    async function setDriverActive(driverId, active) {
      const verb = active ? 'reactivate' : 'deactivate';
      if (!confirm('Do you want to ' + verb + ' driver ' + driverId + '?')) return;
      const response = await fetch('/api/drivers/' + encodeURIComponent(driverId) + '/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      const data = await response.json().catch(() => ({}));
      document.getElementById('message').textContent = response.ok
        ? 'Updated driver ' + data.driver.driverId + '.'
        : data.error || 'Unable to update driver.';
      loadDrivers();
    }

    function loadDriverTemplate() {
      document.getElementById('csvText').value = [
        'driver_id,driver_name,employee_number,phone_number,supervisor_username,supervisor_name,team_name,route_group,territory,active,notes',
        'driver_app,Truck-Safe Driver,100001,,supervisor_north,North Supervisor,San Antonio North,San Antonio North,San Antonio,true,Pilot test driver',
        'driver_002,Driver Two,100002,,supervisor_lv,Leon Valley Supervisor,Leon Valley Team,Leon Valley,San Antonio,true,'
      ].join('\\n');
    }

    async function importDrivers() {
      const response = await fetch('/api/drivers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: document.getElementById('csvText').value })
      });
      const data = await response.json().catch(() => ({}));
      document.getElementById('message').textContent = response.ok
        ? 'Imported ' + data.summary.saved + ' drivers. Warnings: ' + data.summary.warnings + '.'
        : data.error || 'Driver import failed.';
      if (response.ok) loadDrivers();
    }

    async function loadDrivers() {
      const query = new URLSearchParams({ limit: '500' });
      const search = inputValue('search');
      const active = document.getElementById('activeFilter').value;
      if (search) query.set('search', search);
      if (active) query.set('active', active);
      const response = await fetch('/api/drivers?' + query.toString());
      const data = await response.json().catch(() => ({}));
      const drivers = data.drivers || [];
      window.__drivers = drivers;
      document.getElementById('drivers').innerHTML =
        '<table><thead><tr><th>Driver</th><th>Supervisor / Team</th><th>Employee</th><th>Phone</th><th>Route Group</th><th>Territory</th><th>Status</th><th>Notes</th><th></th></tr></thead><tbody>' +
        drivers.map((driver, index) => '<tr>' +
          '<td><strong>' + escapeHtml(driver.driverName) + '</strong><br><span class="muted">' + escapeHtml(driver.driverId) + '</span></td>' +
          '<td><strong>' + escapeHtml(driver.supervisorName || driver.supervisorUsername || '-') + '</strong><br><span class="muted">' + escapeHtml(driver.teamName || '-') + '</span></td>' +
          '<td>' + escapeHtml(driver.employeeNumber || '-') + '</td>' +
          '<td>' + escapeHtml(driver.phoneNumber || '-') + '</td>' +
          '<td>' + escapeHtml(driver.routeGroup || '-') + '</td>' +
          '<td>' + escapeHtml(driver.territory || '-') + '</td>' +
          '<td class="' + (driver.active ? 'status-active' : 'status-inactive') + '">' + (driver.active ? 'Active' : 'Inactive') + '</td>' +
          '<td>' + escapeHtml(driver.notes || '') + '</td>' +
          '<td><div class="row-actions">' +
            '<button class="secondary" onclick="editDriver(window.__drivers[' + index + '])">Edit</button>' +
            (driver.active
              ? '<button class="danger" onclick="setDriverActive(decodeURIComponent(\\'' + encodeURIComponent(driver.driverId) + '\\'), false)">Deactivate</button>'
              : '<button class="green" onclick="setDriverActive(decodeURIComponent(\\'' + encodeURIComponent(driver.driverId) + '\\'), true)">Reactivate</button>') +
          '</div></td>' +
        '</tr>').join('') +
        '</tbody></table>';
    }

    loadDrivers();
  </script>
</body>
</html>`;
}

function normalizeDriverCsv(csvText) {
  const rows = parse(csvText, {
    columns: (headers) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });
  return Array.isArray(rows) ? rows : [];
}

router.get('/admin', requireAdminSession, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderDriverRegistryAdminPage(req.adminSession));
});

router.get('/', requireAdminSession, async (req, res) => {
  try {
    const drivers = await repositories.listDrivers({
      search: req.query.search,
      active: req.query.active,
      supervisorUsername: req.query.supervisorUsername || req.query.supervisor_username,
      teamName: req.query.teamName || req.query.team_name,
      limit: req.query.limit
    });
    return res.json({ ok: true, drivers });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to list drivers.' });
  }
});

router.get('/:driverId', requireAdminSession, async (req, res) => {
  try {
    const driver = await repositories.getDriver(req.params.driverId);
    if (!driver) return res.status(404).json({ error: 'Driver not found.' });
    return res.json({ ok: true, driver });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to load driver.' });
  }
});

router.post('/', requireAdminSession, async (req, res) => {
  try {
    const driver = await repositories.upsertDriver(req.body || {}, req.adminSession?.username || 'supervisor');
    return res.json({ ok: true, driver });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Unable to save driver.' });
  }
});

router.post('/import', requireAdminSession, async (req, res) => {
  try {
    const csvText = cleanText(req.body?.csvText, 10_000_000);
    if (!csvText) return res.status(400).json({ error: 'csvText is required.' });

    const rows = normalizeDriverCsv(csvText);
    const savedDrivers = [];
    const warnings = [];

    for (const [index, row] of rows.entries()) {
      const driverId = cleanText(readCell(row, 'driverId'), 120);
      const driverName = cleanText(readCell(row, 'driverName'), 180);
      if (!driverId || !driverName) {
        warnings.push({
          row: index + 2,
          reason: !driverId ? 'Missing driver_id' : 'Missing driver_name'
        });
        continue;
      }

      const driver = await repositories.upsertDriver({
        driverId,
        driverName,
        employeeNumber: cleanText(readCell(row, 'employeeNumber'), 120),
        phoneNumber: cleanText(readCell(row, 'phoneNumber'), 80),
        supervisorUsername: cleanText(readCell(row, 'supervisorUsername'), 120),
        supervisorName: cleanText(readCell(row, 'supervisorName'), 160),
        teamName: cleanText(readCell(row, 'teamName'), 160),
        routeGroup: cleanText(readCell(row, 'routeGroup'), 120),
        territory: cleanText(readCell(row, 'territory'), 120),
        active: parseActive(readCell(row, 'active')),
        notes: cleanText(readCell(row, 'notes'), 1000)
      }, req.adminSession?.username || 'supervisor');
      savedDrivers.push(driver);
    }

    return res.json({
      ok: true,
      summary: {
        rows: rows.length,
        saved: savedDrivers.length,
        warnings: warnings.length
      },
      warnings,
      drivers: savedDrivers
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Driver import failed.' });
  }
});

router.put('/:driverId', requireAdminSession, async (req, res) => {
  try {
    const driver = await repositories.upsertDriver({
      ...req.body,
      driverId: req.params.driverId
    }, req.adminSession?.username || 'supervisor');
    return res.json({ ok: true, driver });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || 'Unable to update driver.' });
  }
});

router.put('/:driverId/active', requireAdminSession, async (req, res) => {
  try {
    const driver = await repositories.setDriverActive(
      req.params.driverId,
      req.body?.active === true,
      req.adminSession?.username || 'supervisor'
    );
    if (!driver) return res.status(404).json({ error: 'Driver not found.' });
    return res.json({ ok: true, driver });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to update driver status.' });
  }
});

module.exports = router;
