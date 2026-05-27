const crypto = require('crypto');
const express = require('express');
const { parse } = require('csv-parse/sync');
const adminAuth = require('../services/adminAuth');
const driverAuth = require('../services/driverAuth');
const repositories = require('../db/repositories');

const router = express.Router();

const COLUMN_ALIASES = {
  routeDate: ['route_date', 'date', 'delivery_date', 'route day', 'route_date'],
  routeNumber: ['route_number', 'route', 'route_id', 'route id', 'route #', 'route no', 'rt'],
  routeName: ['route_name', 'route name', 'description'],
  routeStart: ['planned_route_start', 'route_start', 'begin_time', 'start_time', 'route begin', 'route start'],
  routeEnd: ['planned_route_end', 'route_end', 'end_time', 'route end'],
  startLocation: ['start_location', 'warehouse', 'depot', 'origin'],
  stopSequence: ['stop_sequence', 'stop', 'sequence', 'seq', 'stop #', 'stop_number'],
  accountNumber: ['account_number', 'account #', 'customer_number', 'customer #', 'acct', 'account'],
  accountName: ['account_name', 'customer_name', 'customer', 'business_name', 'store_name', 'name'],
  address: ['address', 'destination_address', 'street_address', 'ship_to_address', 'delivery_address'],
  city: ['city'],
  stateCode: ['state', 'state_code', 'st'],
  postalCode: ['zip', 'zipcode', 'postal_code', 'postal code'],
  plannedArrival: ['planned_arrival', 'arrival', 'eta', 'planned arrival', 'arrival_time'],
  plannedDeparture: ['planned_departure', 'departure', 'planned departure', 'departure_time'],
  plannedServiceMinutes: ['planned_service_minutes', 'service_minutes', 'unload_minutes', 'planned unload', 'stop minutes'],
  driveMinutesToNext: ['drive_minutes_to_next', 'drive_to_next', 'travel_minutes_to_next', 'next_drive_minutes'],
  palletCount: ['pallet_count', 'pallets', 'skids', 'skid_count', 'total_pallets'],
  caseCount: ['case_count', 'cases', 'total_cases', 'case_qty', 'quantity_cases'],
  itemSummary: ['item_summary', 'items', 'products', 'sku_summary'],
  assignedDriverId: ['assigned_driver_id', 'driver_id', 'driver id', 'employee_id', 'employee id', 'route_driver_id'],
  assignedDriverName: ['assigned_driver_name', 'driver_name', 'driver name', 'driver', 'employee_name', 'employee name']
};

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeHeader(value) {
  return cleanText(value, 120).toLowerCase().replace(/[\s.-]+/g, '_');
}

function readCell(row, fieldName) {
  const aliases = COLUMN_ALIASES[fieldName] || [];
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    if (Object.prototype.hasOwnProperty.call(row, normalizedAlias)) {
      return row[normalizedAlias];
    }
  }
  return '';
}

function parseInteger(value) {
  const cleaned = cleanText(value, 40).replace(/,/g, '');
  if (!cleaned) return 0;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseMinutes(value) {
  const cleaned = cleanText(value, 40);
  if (!cleaned) return null;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeDate(value) {
  const cleaned = cleanText(value, 80);
  if (!cleaned) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  const match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return new Date().toISOString().slice(0, 10);
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

function parseDateTime(routeDate, value) {
  const cleaned = cleanText(value, 80);
  if (!cleaned) return null;
  const direct = new Date(cleaned);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString();

  const timeMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!timeMatch) return null;
  let hour = Number.parseInt(timeMatch[1], 10);
  const minute = Number.parseInt(timeMatch[2] || '0', 10);
  const meridiem = String(timeMatch[3] || '').toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;

  const parsed = new Date(`${routeDate}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function stableId(parts) {
  return crypto.createHash('sha1').update(parts.map((part) => String(part ?? '')).join('|')).digest('hex').slice(0, 24);
}

function normalizeCsvRows(csvText) {
  const records = parse(csvText, {
    columns: (headers) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });
  return Array.isArray(records) ? records : [];
}

function buildManifestImport(csvText, options = {}) {
  const rows = normalizeCsvRows(csvText);
  const routeMap = new Map();
  const warnings = [];

  rows.forEach((row, index) => {
    const routeDate = normalizeDate(readCell(row, 'routeDate') || options.routeDate);
    const routeNumber = cleanText(readCell(row, 'routeNumber'), 80);
    const address = cleanText(readCell(row, 'address'), 500);
    const stopSequence = parseInteger(readCell(row, 'stopSequence')) || index + 1;

    if (!routeNumber || !address) {
      warnings.push({
        row: index + 2,
        reason: !routeNumber ? 'Missing route number' : 'Missing destination address'
      });
      return;
    }

    const routeKey = `${routeDate}:${routeNumber}`;
    if (!routeMap.has(routeKey)) {
      const assignedDriverId = cleanText(readCell(row, 'assignedDriverId'), 120);
      const assignedDriverName = cleanText(readCell(row, 'assignedDriverName'), 160);
      routeMap.set(routeKey, {
        id: `manifest_${stableId([routeDate, routeNumber])}`,
        routeDate,
        routeNumber,
        routeName: cleanText(readCell(row, 'routeName'), 160) || null,
        startLocation: cleanText(readCell(row, 'startLocation'), 240) || null,
        plannedStartAt: parseDateTime(routeDate, readCell(row, 'routeStart')),
        plannedEndAt: parseDateTime(routeDate, readCell(row, 'routeEnd')),
        sourceFileName: cleanText(options.fileName, 240) || null,
        importedBy: cleanText(options.importedBy, 120) || 'supervisor',
        assignedDriverId: assignedDriverId || null,
        assignedDriverName: assignedDriverName || assignedDriverId || null,
        assignedAt: assignedDriverId ? new Date().toISOString() : null,
        assignedBy: assignedDriverId ? cleanText(options.importedBy, 120) || 'csv_import' : null,
        status: assignedDriverId ? 'assigned' : 'unassigned',
        raw: {
          source: 'csv_import',
          fileName: cleanText(options.fileName, 240) || null,
          bulkAssigned: !!assignedDriverId
        },
        stops: []
      });
    }

    const manifest = routeMap.get(routeKey);
    const palletCount = parseInteger(readCell(row, 'palletCount'));
    const caseCount = parseInteger(readCell(row, 'caseCount'));
    manifest.stops.push({
      id: `stop_${stableId([routeDate, routeNumber, stopSequence, readCell(row, 'accountNumber'), address])}`,
      stopSequence,
      accountNumber: cleanText(readCell(row, 'accountNumber'), 120) || null,
      accountName: cleanText(readCell(row, 'accountName'), 200) || null,
      destinationAddress: address,
      city: cleanText(readCell(row, 'city'), 120) || null,
      stateCode: cleanText(readCell(row, 'stateCode'), 2).toUpperCase() || null,
      postalCode: cleanText(readCell(row, 'postalCode'), 20) || null,
      plannedArrivalAt: parseDateTime(routeDate, readCell(row, 'plannedArrival')),
      plannedDepartureAt: parseDateTime(routeDate, readCell(row, 'plannedDeparture')),
      plannedServiceMinutes: parseMinutes(readCell(row, 'plannedServiceMinutes')),
      driveMinutesToNext: parseMinutes(readCell(row, 'driveMinutesToNext')),
      palletCount,
      caseCount,
      itemSummary: cleanText(readCell(row, 'itemSummary'), 2000)
        ? [{ summary: cleanText(readCell(row, 'itemSummary'), 2000) }]
        : [],
      status: 'pending',
      raw: row
    });
  });

  const manifests = [...routeMap.values()].map((manifest) => {
    const stops = manifest.stops.sort((left, right) => left.stopSequence - right.stopSequence);
    const plannedStart = manifest.plannedStartAt ? new Date(manifest.plannedStartAt) : null;
    const plannedEnd = manifest.plannedEndAt ? new Date(manifest.plannedEndAt) : null;
    const plannedDurationMinutes =
      plannedStart && plannedEnd && !Number.isNaN(plannedStart.getTime()) && !Number.isNaN(plannedEnd.getTime())
        ? Math.max(0, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60000))
        : null;

    return {
      ...manifest,
      plannedDurationMinutes,
      totalStops: stops.length,
      totalPallets: stops.reduce((sum, stop) => sum + stop.palletCount, 0),
      totalCases: stops.reduce((sum, stop) => sum + stop.caseCount, 0),
      stops
    };
  });

  return {
    manifests,
    warnings,
    summary: {
      routes: manifests.length,
      stops: manifests.reduce((sum, manifest) => sum + manifest.totalStops, 0),
      pallets: manifests.reduce((sum, manifest) => sum + manifest.totalPallets, 0),
      cases: manifests.reduce((sum, manifest) => sum + manifest.totalCases, 0),
      warnings: warnings.length
    }
  };
}

function requireAdminSession(req, res, next) {
  const session = adminAuth.getAdminSession(req);
  if (session) {
    req.adminSession = session;
    return next();
  }
  return res.status(401).json({ error: 'Supervisor admin login required.' });
}

function renderRouteManifestAdminPage() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Truck-Safe Route Manifests</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #081722; color: #eef8ff; }
    header { padding: 28px 34px; background: linear-gradient(135deg, #092b3a, #7a1117); }
    h1 { margin: 0; font-size: 30px; }
    main { padding: 24px 34px 48px; display: grid; gap: 18px; }
    .tabs { display: flex; gap: 10px; flex-wrap: wrap; }
    .tab, button { border: 0; border-radius: 12px; padding: 10px 14px; color: #fff; background: #0d6efd; font-weight: 800; text-decoration: none; cursor: pointer; }
    .tab.active { background: #00a9b8; color: #05222a; }
    .panel { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); border-radius: 18px; padding: 18px; }
    textarea, input, select { width: 100%; box-sizing: border-box; border-radius: 12px; border: 1px solid #31596a; background: #06121b; color: #fff; padding: 12px; }
    textarea { min-height: 220px; font-family: Consolas, monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { text-align: left; border-bottom: 1px solid rgba(255,255,255,0.14); padding: 10px; vertical-align: top; }
    th { color: #82f5ff; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
    .message { min-height: 22px; color: #a6ffb8; font-weight: 800; }
    .muted { color: #a9bdc7; }
    .danger { background: #c62828; }
    .row-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  </style>
</head>
<body>
  <header>
    <h1>Daily Route Manifest</h1>
    <p>Import full daily route files, review totals, and assign routes to drivers.</p>
  </header>
  <main>
    <nav class="tabs">
      <a class="tab" href="/api/routing/manual-hazards/admin">Hazard Review</a>
      <a class="tab" href="/api/routing/hazard-verification/admin">Static Hazard Verification</a>
      <a class="tab" href="/api/routing/route-sessions/admin">Route Replay</a>
      <a class="tab" href="/api/delivery-notes/admin">Delivery Notes</a>
      <a class="tab active" href="/api/route-manifests/admin">Route Manifests</a>
      <a class="tab" href="/api/drivers/admin">Driver Registry</a>
      <a class="tab" href="/api/routing/manual-hazards/admin-users/admin">Admin Users</a>
    </nav>
    <section class="panel">
      <h2>Import CSV</h2>
      <p class="muted">Required columns: route number, stop sequence, address. Recommended: route date, route start, route end, account number, account name, pallets, cases, assigned_driver_id, assigned_driver_name.</p>
      <p><button onclick="loadProductionTemplate()">Use Production Bulk Assignment Template</button></p>
      <div class="grid">
        <div><label>File name</label><input id="fileName" placeholder="DailyRoutes_2026-05-25.csv" /></div>
        <div><label>Imported by</label><input id="importedBy" placeholder="Supervisor name" /></div>
      </div>
      <p><input id="filePicker" type="file" accept=".csv,text/csv" /></p>
      <textarea id="csvText" placeholder="Paste CSV here or choose a CSV file above"></textarea>
      <p><button onclick="importCsv()">Import Routes</button></p>
      <div id="message" class="message"></div>
    </section>
    <section class="panel">
      <h2>Imported Routes</h2>
      <div class="grid">
        <div><label>Filter/delete date</label><input id="routeDateFilter" placeholder="YYYY-MM-DD" /></div>
        <div><label>Assign to registered driver</label><select id="driverSelect"><option value="">Loading drivers...</option></select></div>
        <div>
          <label>&nbsp;</label>
          <div class="row-actions">
            <button onclick="loadRoutes()">Refresh</button>
            <button onclick="switchSelectedRoutes()">Switch Selected Route Assignments</button>
            <button class="danger" onclick="deleteRoutesByDate()">Delete Routes for Date</button>
          </div>
        </div>
      </div>
      <div id="routes"></div>
    </section>
  </main>
  <script>
    const filePicker = document.getElementById('filePicker');
    filePicker.addEventListener('change', async () => {
      const file = filePicker.files && filePicker.files[0];
      if (!file) return;
      document.getElementById('fileName').value = file.name;
      document.getElementById('csvText').value = await file.text();
    });

    function escapeHtml(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c]));
    }

    function encodeAttr(value) {
      return encodeURIComponent(String(value == null ? '' : value));
    }

    async function importCsv() {
      const response = await fetch('/api/route-manifests/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: document.getElementById('csvText').value,
          fileName: document.getElementById('fileName').value,
          importedBy: document.getElementById('importedBy').value
        })
      });
      const data = await response.json();
      document.getElementById('message').textContent = response.ok
        ? 'Imported ' + data.summary.routes + ' routes, ' + data.summary.stops + ' stops, ' + data.summary.pallets + ' pallets, ' + data.summary.cases + ' cases.'
        : data.error || 'Import failed.';
      if (response.ok) loadRoutes();
    }

    function loadProductionTemplate() {
      document.getElementById('fileName').value = 'daily-route-bulk-assignment-template.csv';
      document.getElementById('csvText').value = [
        'route_date,route_number,route_name,planned_route_start,planned_route_end,start_location,assigned_driver_id,assigned_driver_name,stop_sequence,account_number,account_name,address,city,state,zip,planned_arrival,planned_departure,planned_service_minutes,drive_minutes_to_next,pallet_count,case_count,item_summary',
        '2026-05-25,RT-101,San Antonio North,7:00 AM,3:30 PM,San Antonio DC,driver_app,Truck-Safe Driver,1,100245,Alamo City Stripers,"4337 E Houston St, San Antonio, TX 78220",San Antonio,TX,78220,7:35 AM,7:55 AM,20,14,2,86,"CSD cases; cooler reset"',
        '2026-05-25,RT-101,San Antonio North,7:00 AM,3:30 PM,San Antonio DC,driver_app,Truck-Safe Driver,2,100246,Eastside Market,"5030 Rigsby Ave, San Antonio, TX 78222",San Antonio,TX,78222,8:10 AM,8:28 AM,18,16,1,44,"Water; mini cans"',
        '2026-05-25,RT-102,Leon Valley,6:45 AM,2:45 PM,San Antonio DC,driver_002,Driver Two,1,200100,Vape City,"5772 Evers Rd, Leon Valley, TX 78238",Leon Valley,TX,78238,7:20 AM,7:38 AM,18,12,1,52,"Core CSD"',
        '2026-05-25,RT-102,Leon Valley,6:45 AM,2:45 PM,San Antonio DC,driver_002,Driver Two,2,200101,AutoZone,"5803 NW Loop 410, San Antonio, TX 78238",San Antonio,TX,78238,7:50 AM,8:15 AM,25,15,3,120,"Bulk pallets"'
      ].join('\\n');
    }

    async function loadDriversForAssignment() {
      const select = document.getElementById('driverSelect');
      const response = await fetch('/api/drivers?active=true&limit=1000');
      const data = await response.json().catch(() => ({}));
      const drivers = data.drivers || [];
      select.innerHTML = '<option value="">Choose active driver...</option>' + drivers.map(driver =>
        '<option value="' + encodeAttr(driver.driverId) + '" data-name="' + encodeAttr(driver.driverName) + '">' +
          escapeHtml(driver.driverName) + ' - ' + escapeHtml(driver.driverId) +
          (driver.supervisorName || driver.teamName ? ' (' + escapeHtml([driver.supervisorName, driver.teamName].filter(Boolean).join(' / ')) + ')' : '') +
        '</option>'
      ).join('');
    }

    async function assignRoute(id) {
      const select = document.getElementById('driverSelect');
      const selected = select.options[select.selectedIndex];
      const driverId = selected ? decodeURIComponent(selected.value || '') : '';
      const driverName = selected ? decodeURIComponent(selected.dataset.name || driverId) : '';
      if (!driverId) {
        alert('Choose an active registered driver first.');
        return;
      }
      const response = await fetch('/api/route-manifests/' + encodeURIComponent(id) + '/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, driverName })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'Assignment failed.');
      }
      loadRoutes();
    }

    async function switchSelectedRoutes() {
      const checked = Array.from(document.querySelectorAll('input[name="routeSwitch"]:checked')).map(input => input.value);
      if (checked.length !== 2) {
        alert('Select exactly two routes to switch assignments.');
        return;
      }
      if (!confirm('Switch the assigned drivers between the two selected routes?')) return;
      const response = await fetch('/api/route-manifests/switch-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leftRouteId: checked[0], rightRouteId: checked[1] })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data.error || 'Unable to switch route assignments.');
        return;
      }
      document.getElementById('message').textContent = 'Switched route assignments.';
      loadRoutes();
    }

    async function deleteRoute(id, routeNumber, routeDate) {
      if (!confirm('Delete route ' + routeNumber + ' for ' + routeDate + '? This deletes the route and every stop connected to it.')) return;
      const response = await fetch('/api/route-manifests/' + encodeURIComponent(id) + '?confirm=DELETE', { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data.error || 'Delete failed.');
        return;
      }
      document.getElementById('message').textContent = 'Deleted route ' + routeNumber + ' and ' + data.deletedStops + ' stops.';
      loadRoutes();
    }

    async function deleteRoutesByDate() {
      const routeDate = document.getElementById('routeDateFilter').value.trim();
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(routeDate)) {
        alert('Enter a route date as YYYY-MM-DD first.');
        return;
      }
      const confirmation = prompt('Type DELETE ' + routeDate + ' to delete every route manifest and stop for this date.');
      if (confirmation !== 'DELETE ' + routeDate) return;

      const response = await fetch('/api/route-manifests/date/' + encodeURIComponent(routeDate) + '?confirm=DELETE', { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data.error || 'Date delete failed.');
        return;
      }
      document.getElementById('message').textContent = 'Deleted ' + data.deletedRoutes + ' routes and ' + data.deletedStops + ' stops for ' + routeDate + '.';
      loadRoutes();
    }

    async function loadRoutes() {
      const routeDate = document.getElementById('routeDateFilter').value.trim();
      const query = new URLSearchParams({ limit: '200' });
      if (/^\\d{4}-\\d{2}-\\d{2}$/.test(routeDate)) query.set('routeDate', routeDate);
      const response = await fetch('/api/route-manifests?' + query.toString());
      const data = await response.json();
      const routes = data.routes || [];
      document.getElementById('routes').innerHTML =
        '<table><thead><tr><th>Switch</th><th>Date</th><th>Route</th><th>Times</th><th>Stops</th><th>Pallets</th><th>Cases</th><th>Driver</th><th>Status</th><th></th></tr></thead><tbody>' +
        routes.map(route => '<tr>' +
          '<td><input type="checkbox" name="routeSwitch" value="' + escapeHtml(route.id) + '" /></td>' +
          '<td>' + escapeHtml(route.routeDate) + '</td>' +
          '<td><strong>' + escapeHtml(route.routeNumber) + '</strong><br><span class="muted">' + escapeHtml(route.routeName || '') + '</span></td>' +
          '<td>' + escapeHtml(route.plannedStartAt || '-') + '<br>' + escapeHtml(route.plannedEndAt || '-') + '</td>' +
          '<td>' + escapeHtml(route.totalStops) + '</td>' +
          '<td>' + escapeHtml(route.totalPallets) + '</td>' +
          '<td>' + escapeHtml(route.totalCases) + '</td>' +
          '<td>' + escapeHtml(route.assignedDriverName || route.assignedDriverId || 'Unassigned') + '</td>' +
          '<td>' + escapeHtml(route.status) + '</td>' +
          '<td><div class="row-actions">' +
            '<button onclick="assignRoute(decodeURIComponent(\\'' + encodeURIComponent(route.id) + '\\'))">Assign/Reassign</button>' +
            '<button class="danger" onclick="deleteRoute(decodeURIComponent(\\'' + encodeURIComponent(route.id) + '\\'), decodeURIComponent(\\'' + encodeURIComponent(route.routeNumber) + '\\'), decodeURIComponent(\\'' + encodeURIComponent(route.routeDate) + '\\'))">Delete</button>' +
          '</div></td>' +
        '</tr>').join('') +
        '</tbody></table>';
    }
    loadDriversForAssignment();
    loadRoutes();
  </script>
</body>
</html>`;
}

router.get('/admin', (req, res) => {
  if (!adminAuth.getAdminSession(req)) {
    return res.redirect('/api/routing/manual-hazards/admin/login');
  }
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderRouteManifestAdminPage());
});

router.post('/import', requireAdminSession, async (req, res) => {
  try {
    const csvText = cleanText(req.body?.csvText, 10_000_000);
    if (!csvText) return res.status(400).json({ error: 'csvText is required.' });

    const importResult = buildManifestImport(csvText, {
      fileName: req.body?.fileName,
      importedBy: req.body?.importedBy || req.adminSession?.username
    });

    const savedRoutes = [];
    for (const manifest of importResult.manifests) {
      const savedManifest = await repositories.upsertDailyRouteManifest(manifest);
      const savedStops = await repositories.replaceDailyRouteStops(savedManifest.id, manifest.stops);
      savedRoutes.push({ ...savedManifest, stops: savedStops });
    }

    return res.json({
      ok: true,
      summary: importResult.summary,
      warnings: importResult.warnings,
      routes: savedRoutes
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Route manifest import failed.'
    });
  }
});

router.get('/', requireAdminSession, async (req, res) => {
  try {
    const routes = await repositories.listDailyRouteManifests({
      routeDate: req.query.routeDate,
      driverId: req.query.driverId,
      status: req.query.status,
      limit: req.query.limit
    });
    return res.json({ ok: true, routes });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to list route manifests.' });
  }
});

router.get('/driver/today', driverAuth.requireDriverAuth, async (req, res) => {
  try {
    const identity = driverAuth.getDriverIdentity(req);
    const routeDate = normalizeDate(req.query.routeDate || req.query.date);
    const route = await repositories.getAssignedDailyRouteForDriver(identity.driverId, routeDate);
    return res.json({ ok: true, routeDate, driver: identity, route });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to load assigned driver route.' });
  }
});

router.put('/driver/stops/:stopId/status', driverAuth.requireDriverAuth, async (req, res) => {
  try {
    const identity = driverAuth.getDriverIdentity(req);
    const updatedStop = await repositories.updateDailyRouteStopStatusForDriver(
      req.params.stopId,
      identity.driverId,
      req.body || {}
    );

    if (!updatedStop) {
      return res.status(404).json({
        error: 'Assigned route stop not found for this driver.'
      });
    }

    const routeDate = normalizeDate(req.body?.routeDate || req.query.routeDate || req.query.date);
    const route = await repositories.getAssignedDailyRouteForDriver(identity.driverId, routeDate);
    return res.json({
      ok: true,
      driver: identity,
      stop: updatedStop,
      route
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to update route stop status.'
    });
  }
});

router.delete('/date/:routeDate', requireAdminSession, async (req, res) => {
  try {
    const confirmation = String(req.query.confirm || req.body?.confirm || '').trim();
    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        error: 'Delete confirmation is required.'
      });
    }

    const result = await repositories.deleteDailyRouteManifestsByDate(req.params.routeDate);
    return res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to delete route manifests for this date.'
    });
  }
});

router.post('/switch-assignments', requireAdminSession, async (req, res) => {
  try {
    const routes = await repositories.swapDailyRouteAssignments(
      req.body?.leftRouteId || req.body?.left_route_id,
      req.body?.rightRouteId || req.body?.right_route_id,
      {
        assignedBy: req.adminSession?.username || req.body?.assignedBy
      }
    );
    return res.json({ ok: true, routes });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to switch route assignments.'
    });
  }
});

router.get('/:id', requireAdminSession, async (req, res) => {
  try {
    const route = await repositories.getDailyRouteManifest(req.params.id);
    if (!route) return res.status(404).json({ error: 'Route manifest not found.' });
    return res.json({ ok: true, route });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to load route manifest.' });
  }
});

router.delete('/:id', requireAdminSession, async (req, res) => {
  try {
    const confirmation = String(req.query.confirm || req.body?.confirm || '').trim();
    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        error: 'Delete confirmation is required.'
      });
    }

    const result = await repositories.deleteDailyRouteManifest(req.params.id);
    if (!result) return res.status(404).json({ error: 'Route manifest not found.' });
    return res.json({
      ok: true,
      route: result.route,
      deletedStops: result.deletedStops
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to delete route manifest.'
    });
  }
});

router.put('/:id/assign', requireAdminSession, async (req, res) => {
  try {
    const route = await repositories.assignDailyRouteManifest(req.params.id, {
      ...req.body,
      assignedBy: req.adminSession?.username || req.body?.assignedBy
    });
    if (!route) return res.status(404).json({ error: 'Route manifest not found.' });
    return res.json({ ok: true, route });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to assign route manifest.'
    });
  }
});

module.exports = router;
