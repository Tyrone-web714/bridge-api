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
  invoiceNumber: ['invoice_number', 'invoice', 'invoice_no', 'invoice #', 'order_number', 'order_no', 'order #'],
  sku: ['sku', 'item_sku', 'product_sku', 'product_code', 'item_code'],
  productName: ['product_name', 'product', 'item_name', 'item', 'product_description', 'item_description'],
  brand: ['brand'],
  packageSize: ['package_size', 'package', 'pack_size', 'size'],
  productCategory: ['category', 'product_category'],
  productQuantity: ['product_quantity', 'sku_quantity', 'item_quantity', 'quantity', 'units', 'ordered_quantity'],
  unitPrice: ['unit_price', 'price', 'case_price'],
  grossAmount: ['gross_amount', 'line_total', 'extended_price', 'amount'],
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

function parseNumber(value) {
  const cleaned = cleanText(value, 40).replace(/[$,]/g, '');
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseMinutes(value) {
  const cleaned = cleanText(value, 40);
  if (!cleaned) return null;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function currentOperationalDate() {
  const timeZone = process.env.ROUTE_OPERATING_TIMEZONE || 'America/Chicago';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeDate(value) {
  const cleaned = cleanText(value, 80);
  if (!cleaned) return currentOperationalDate();
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  const match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return currentOperationalDate();
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

function buildOrderItemFromRow(row) {
  const sku = cleanText(readCell(row, 'sku'), 120);
  const productName = cleanText(readCell(row, 'productName'), 240);
  if (!sku && !productName) return null;

  const quantity = parseNumber(readCell(row, 'productQuantity')) || parseNumber(readCell(row, 'caseCount'));
  const unitPrice = parseNumber(readCell(row, 'unitPrice'));
  const grossAmount = parseNumber(readCell(row, 'grossAmount')) || (quantity && unitPrice ? quantity * unitPrice : 0);

  return {
    sku: sku || null,
    productName: productName || sku,
    brand: cleanText(readCell(row, 'brand'), 120) || null,
    packageSize: cleanText(readCell(row, 'packageSize'), 120) || null,
    category: cleanText(readCell(row, 'productCategory'), 120) || null,
    quantity,
    unitPrice,
    grossAmount,
    raw: row
  };
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
        stops: [],
        stopMap: new Map()
      });
    }

    const manifest = routeMap.get(routeKey);
    const palletCount = parseInteger(readCell(row, 'palletCount'));
    const caseCount = parseInteger(readCell(row, 'caseCount'));
    const accountNumber = cleanText(readCell(row, 'accountNumber'), 120) || null;
    const accountName = cleanText(readCell(row, 'accountName'), 200) || null;
    const invoiceNumber = cleanText(readCell(row, 'invoiceNumber'), 160) || null;
    const orderItem = buildOrderItemFromRow(row);
    const stopKey = stableId([routeDate, routeNumber, stopSequence, accountNumber, address]);
    let stop = manifest.stopMap.get(stopKey);

    if (!stop) {
      stop = {
        id: `stop_${stopKey}`,
        stopSequence,
        accountNumber,
        accountName,
        destinationAddress: address,
        city: cleanText(readCell(row, 'city'), 120) || null,
        stateCode: cleanText(readCell(row, 'stateCode'), 2).toUpperCase() || null,
        postalCode: cleanText(readCell(row, 'postalCode'), 20) || null,
        plannedArrivalAt: parseDateTime(routeDate, readCell(row, 'plannedArrival')),
        plannedDepartureAt: parseDateTime(routeDate, readCell(row, 'plannedDeparture')),
        plannedServiceMinutes: parseMinutes(readCell(row, 'plannedServiceMinutes')),
        driveMinutesToNext: parseMinutes(readCell(row, 'driveMinutesToNext')),
        palletCount,
        caseCount: orderItem ? Math.round(orderItem.quantity || caseCount || 0) : caseCount,
        itemSummary: [],
        status: 'pending',
        raw: row,
        order: {
          invoiceNumber,
          orderDate: routeDate,
          deliveryDate: routeDate,
          items: []
        }
      };
      manifest.stopMap.set(stopKey, stop);
      manifest.stops.push(stop);
    } else {
      stop.palletCount = Math.max(Number(stop.palletCount) || 0, palletCount);
      stop.caseCount += orderItem ? Math.round(orderItem.quantity || 0) : 0;
      if (!stop.accountName && accountName) stop.accountName = accountName;
      if (!stop.order.invoiceNumber && invoiceNumber) stop.order.invoiceNumber = invoiceNumber;
    }

    const itemSummary = cleanText(readCell(row, 'itemSummary'), 2000);
    if (orderItem) {
      stop.order.items.push(orderItem);
      stop.itemSummary.push({
        sku: orderItem.sku,
        productName: orderItem.productName,
        quantity: orderItem.quantity,
        unitPrice: orderItem.unitPrice,
        grossAmount: orderItem.grossAmount
      });
    } else if (itemSummary) {
      stop.itemSummary.push({ summary: itemSummary });
    }

    stop.raw = {
      ...stop.raw,
      account_order: stop.order,
      source_rows: [...(stop.raw?.source_rows || []), row]
    };

  });

  const manifests = [...routeMap.values()].map((manifest) => {
    const { stopMap, ...cleanManifest } = manifest;
    const stops = manifest.stops.sort((left, right) => left.stopSequence - right.stopSequence);
    const plannedStart = manifest.plannedStartAt ? new Date(manifest.plannedStartAt) : null;
    const plannedEnd = manifest.plannedEndAt ? new Date(manifest.plannedEndAt) : null;
    const plannedDurationMinutes =
      plannedStart && plannedEnd && !Number.isNaN(plannedStart.getTime()) && !Number.isNaN(plannedEnd.getTime())
        ? Math.max(0, Math.round((plannedEnd.getTime() - plannedStart.getTime()) / 60000))
        : null;

    return {
      ...cleanManifest,
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
    .secondary { background: #31596a; }
    .danger { background: #c62828; }
    .error { color: #ffb4b4; font-weight: 800; }
    .warning { background: #f9a825; color: #1b1300; }
    .status-pill { display: inline-block; border-radius: 999px; padding: 5px 9px; background: rgba(255,255,255,0.12); font-size: 12px; font-weight: 900; text-transform: uppercase; }
    .row-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    #routes { overflow-x: auto; }
    .route-actions { min-width: 150px; }
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
      <a class="tab" href="/api/account-intelligence/admin">Account Intelligence</a>
      <a class="tab active" href="/api/route-manifests/admin">Route Manifests</a>
      <a class="tab" href="/api/drivers/admin">Driver Registry</a>
      <a class="tab" href="/api/routing/manual-hazards/admin-users/admin">Admin Users</a>
    </nav>
    <section class="panel">
      <h2>Import CSV</h2>
      <p class="muted">Required columns: route number, stop sequence, address. Recommended: route date, route start, route end, account number, account name, pallets, cases, invoice number, SKU, product name, quantity, unit price, assigned_driver_id, assigned_driver_name.</p>
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
        <div>
          <label>Assign to registered driver by name</label>
          <input id="driverSelect" list="activeDriverOptions" placeholder="Loading active drivers..." autocomplete="off" />
          <datalist id="activeDriverOptions"></datalist>
          <div id="driverSelectStatus" class="muted">Loading active driver registry...</div>
          <div class="row-actions" style="margin-top:8px">
            <button type="button" onclick="loadDriversForAssignment()">Refresh Drivers</button>
            <a class="tab" href="/api/drivers/admin">Open Driver Registry</a>
          </div>
        </div>
        <div>
          <label>&nbsp;</label>
          <div class="row-actions">
            <button onclick="loadRoutes()">Refresh Routes</button>
            <button class="secondary" onclick="showAllRoutes()">Show All Routes</button>
            <button onclick="switchSelectedRoutes()">Switch Selected Route Assignments</button>
            <button class="danger" onclick="deleteRoutesByDate()">Delete Routes for Date</button>
          </div>
        </div>
      </div>
      <p id="routesStatus" class="muted">Loading persisted routes...</p>
      <div id="routes"></div>
    </section>
    <section class="panel">
      <h2>Undelivered / Redelivery Queue</h2>
      <p class="muted">Stops marked no-delivery by drivers appear here. Supervisors can cancel the delivery or schedule it for redelivery.</p>
      <div class="grid">
        <div><label>Queue date</label><input id="undeliveredDateFilter" placeholder="YYYY-MM-DD" /></div>
        <div>
          <label>Disposition filter</label>
          <select id="undeliveredStatusFilter">
            <option value="">All no-delivery stops</option>
            <option value="pending">Pending supervisor decision</option>
            <option value="redelivery_scheduled">Redelivery scheduled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label>&nbsp;</label>
          <button onclick="loadUndeliveredStops()">Refresh No-Delivery Queue</button>
        </div>
      </div>
      <div id="undeliveredStops"></div>
    </section>
  </main>
  <script>
    const NON_DELIVERY_REASON_LABELS = {
      customer_refused: 'Customer refused',
      missed_time_window: 'Driver missed time window',
      business_closed: 'Business closed',
      no_payment: 'Customer did not have payment'
    };

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
        ? 'Imported ' + data.summary.routes + ' routes, ' + data.summary.stops + ' stops, ' + data.summary.pallets + ' pallets, ' + data.summary.cases + ' cases, ' + (data.summary.orders || 0) + ' orders, and ' + (data.summary.orderItems || 0) + ' SKU lines.'
        : data.error || 'Import failed.';
      if (response.ok) loadRoutes();
    }

    function loadProductionTemplate() {
      document.getElementById('fileName').value = 'daily-route-bulk-assignment-template.csv';
      document.getElementById('csvText').value = [
        'route_date,route_number,route_name,planned_route_start,planned_route_end,start_location,assigned_driver_id,assigned_driver_name,stop_sequence,account_number,account_name,address,city,state,zip,planned_arrival,planned_departure,planned_service_minutes,drive_minutes_to_next,pallet_count,case_count,invoice_number,sku,product_name,brand,package_size,category,product_quantity,unit_price,gross_amount,item_summary',
        '2026-05-25,RT-101,San Antonio North,7:00 AM,3:30 PM,San Antonio DC,DRV-1001,Jordan Lee,1,100245,Alamo City Stripers,"4337 E Houston St, San Antonio, TX 78220",San Antonio,TX,78220,7:35 AM,7:55 AM,20,14,2,48,INV-100245-1,COKE-12PK,Coca-Cola 12 Pack,Coca-Cola,12 Pack,CSD,48,9.99,479.52,"Front gate delivery"',
        '2026-05-25,RT-101,San Antonio North,7:00 AM,3:30 PM,San Antonio DC,DRV-1001,Jordan Lee,1,100245,Alamo City Stripers,"4337 E Houston St, San Antonio, TX 78220",San Antonio,TX,78220,7:35 AM,7:55 AM,20,14,2,38,INV-100245-1,SPRITE-12PK,Sprite 12 Pack,Sprite,12 Pack,CSD,38,9.49,360.62,"Front gate delivery"',
        '2026-05-25,RT-101,San Antonio North,7:00 AM,3:30 PM,San Antonio DC,DRV-1001,Jordan Lee,2,100246,Eastside Market,"5030 Rigsby Ave, San Antonio, TX 78222",San Antonio,TX,78222,8:10 AM,8:28 AM,18,16,1,44,INV-100246-1,DASANI-24PK,Dasani 24 Pack,Dasani,24 Pack,Water,44,6.75,297.00,"Water; mini cans"',
        '2026-05-25,RT-102,Leon Valley,6:45 AM,2:45 PM,San Antonio DC,DRV-1002,Casey Morgan,1,200100,Vape City,"5772 Evers Rd, Leon Valley, TX 78238",Leon Valley,TX,78238,7:20 AM,7:38 AM,18,12,1,52,INV-200100-1,COKE-ZERO-12PK,Coca-Cola Zero Sugar 12 Pack,Coca-Cola,12 Pack,CSD,52,9.99,519.48,"Core CSD"',
        '2026-05-25,RT-102,Leon Valley,6:45 AM,2:45 PM,San Antonio DC,DRV-1002,Casey Morgan,2,200101,AutoZone,"5803 NW Loop 410, San Antonio, TX 78238",San Antonio,TX,78238,7:50 AM,8:15 AM,25,15,3,120,INV-200101-1,POWERADE-MIX,Powerade Mixed Case,Powerade,Case,Sports Drink,120,11.25,1350.00,"Bulk pallets"'
      ].join('\\n');
    }

    const activeDriversById = new Map();
    const activeDriversByName = new Map();

    async function loadDriversForAssignment() {
      const input = document.getElementById('driverSelect');
      const options = document.getElementById('activeDriverOptions');
      const status = document.getElementById('driverSelectStatus');
      input.disabled = true;
      input.placeholder = 'Loading active drivers...';
      status.textContent = 'Loading active driver registry...';

      try {
        const response = await fetch('/api/drivers?active=true&limit=1000');
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Unable to load active drivers.');
        }

        const drivers = Array.isArray(data.drivers) ? data.drivers : [];
        activeDriversById.clear();
        activeDriversByName.clear();
        drivers.forEach(driver => {
          activeDriversById.set(String(driver.driverId || '').trim().toLowerCase(), driver);
          const normalizedName = String(driver.driverName || '').trim().toLowerCase();
          if (!activeDriversByName.has(normalizedName)) activeDriversByName.set(normalizedName, []);
          activeDriversByName.get(normalizedName).push(driver);
        });
        options.innerHTML = drivers.map(driver =>
          '<option value="' + escapeHtml(driver.driverName) + '">' +
            escapeHtml(driver.driverId) +
            (driver.supervisorName || driver.teamName
              ? ' - ' + escapeHtml([driver.supervisorName, driver.teamName].filter(Boolean).join(' / '))
              : '') +
          '</option>'
        ).join('');

        input.placeholder = drivers.length
          ? 'Type or choose an active driver name...'
          : 'No active drivers registered';
        status.textContent = drivers.length
          ? drivers.length + ' active driver' + (drivers.length === 1 ? '' : 's') + ' available. Type a registered name or choose a suggestion.'
          : 'No active drivers are registered. Open Driver Registry and add or reactivate a driver.';
      } catch (error) {
        activeDriversById.clear();
        activeDriversByName.clear();
        options.innerHTML = '';
        input.placeholder = 'Driver registry unavailable';
        status.textContent = error.message || 'Unable to load active drivers.';
      } finally {
        input.disabled = false;
      }
    }

    async function assignRoute(id) {
      const input = document.getElementById('driverSelect');
      const driverLookup = String(input.value || '').trim();
      if (!driverLookup) {
        alert('Type or choose an active registered driver name first.');
        input.focus();
        return;
      }

      const normalizedLookup = driverLookup.toLowerCase();
      const matchingNames = activeDriversByName.get(normalizedLookup) || [];
      const registeredDriver = activeDriversById.get(normalizedLookup)
        || (matchingNames.length === 1 ? matchingNames[0] : null);
      if (matchingNames.length > 1 && !activeDriversById.has(normalizedLookup)) {
        alert('More than one active driver has that name. Enter the driver ID shown in Driver Registry to choose the correct person.');
        input.focus();
        return;
      }
      if (!registeredDriver) {
        alert('That name is not in the active driver registry. Add the driver in Driver Registry, then return here and press Refresh Drivers.');
        input.focus();
        return;
      }
      const driverId = registeredDriver.driverId;
      const driverName = registeredDriver.driverName || driverId;
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
      const routesStatus = document.getElementById('routesStatus');
      const routesContainer = document.getElementById('routes');
      routesStatus.textContent = 'Loading persisted routes from the backend...';

      try {
        const response = await fetch('/api/route-manifests?' + query.toString());
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Unable to load persisted routes.');
        }

        const routes = Array.isArray(data.routes) ? data.routes : [];
        routesStatus.textContent = routes.length
          ? routes.length + ' persisted route' + (routes.length === 1 ? '' : 's') + ' loaded' +
            (query.has('routeDate') ? ' for ' + routeDate + '.' : '.')
          : query.has('routeDate')
            ? 'No routes match ' + routeDate + '. Press Show All Routes to clear the filter.'
            : 'No route manifests are currently stored in the backend.';
        routesContainer.innerHTML = routes.length
          ?
        '<table><thead><tr><th>Switch</th><th>Actions</th><th>Date</th><th>Route</th><th>Times</th><th>Stops</th><th>Pallets</th><th>Cases</th><th>Driver</th><th>Status</th></tr></thead><tbody>' +
        routes.map(route => '<tr>' +
          '<td><input type="checkbox" name="routeSwitch" value="' + escapeHtml(route.id) + '" /></td>' +
          '<td class="route-actions"><div class="row-actions">' +
            '<button onclick="assignRoute(decodeURIComponent(\\'' + encodeURIComponent(route.id) + '\\'))">Assign/Reassign</button>' +
            '<button class="danger" onclick="deleteRoute(decodeURIComponent(\\'' + encodeURIComponent(route.id) + '\\'), decodeURIComponent(\\'' + encodeURIComponent(route.routeNumber) + '\\'), decodeURIComponent(\\'' + encodeURIComponent(route.routeDate) + '\\'))">Delete</button>' +
          '</div></td>' +
          '<td>' + escapeHtml(route.routeDate) + '</td>' +
          '<td><strong>' + escapeHtml(route.routeNumber) + '</strong><br><span class="muted">' + escapeHtml(route.routeName || '') + '</span></td>' +
          '<td>' + escapeHtml(route.plannedStartAt || '-') + '<br>' + escapeHtml(route.plannedEndAt || '-') + '</td>' +
          '<td>' + escapeHtml(route.totalStops) + '</td>' +
          '<td>' + escapeHtml(route.totalPallets) + '</td>' +
          '<td>' + escapeHtml(route.totalCases) + '</td>' +
          '<td>' + escapeHtml(route.assignedDriverName || route.assignedDriverId || 'Unassigned') + '</td>' +
          '<td>' + escapeHtml(route.status) + '</td>' +
        '</tr>').join('') +
        '</tbody></table>'
          : '';
      } catch (error) {
        routesStatus.textContent = 'Route list failed to reload: ' + (error.message || 'Unknown backend error.');
        routesContainer.innerHTML = '<p class="error">The routes were not deleted. The page could not reload them from the backend. Press Refresh Routes to try again.</p>';
      }
    }

    function showAllRoutes() {
      document.getElementById('routeDateFilter').value = '';
      loadRoutes();
    }

    async function updateUndeliveredDisposition(stopId, redeliveryStatus) {
      const payload = { redeliveryStatus };
      if (redeliveryStatus === 'redelivery_scheduled') {
        const date = prompt('Enter redelivery date as YYYY-MM-DD.');
        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(date || '').trim())) {
          alert('Redelivery date must use YYYY-MM-DD.');
          return;
        }
        payload.redeliveryDate = date.trim();
        payload.redeliveryNotes = prompt('Optional redelivery notes for dispatch/supervisor:', '') || '';
      } else if (redeliveryStatus === 'cancelled') {
        if (!confirm('Cancel this delivery instead of scheduling redelivery?')) return;
        payload.redeliveryNotes = prompt('Optional cancellation note:', '') || '';
      }

      const response = await fetch('/api/route-manifests/undelivered/' + encodeURIComponent(stopId) + '/disposition', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(data.error || 'Unable to update no-delivery disposition.');
        return;
      }
      document.getElementById('message').textContent = 'No-delivery disposition updated.';
      loadUndeliveredStops();
    }

    async function loadUndeliveredStops() {
      const routeDate = document.getElementById('undeliveredDateFilter').value.trim() || document.getElementById('routeDateFilter').value.trim();
      const status = document.getElementById('undeliveredStatusFilter').value;
      const query = new URLSearchParams({ limit: '200' });
      if (/^\\d{4}-\\d{2}-\\d{2}$/.test(routeDate)) query.set('routeDate', routeDate);
      if (status) query.set('redeliveryStatus', status);

      const response = await fetch('/api/route-manifests/undelivered?' + query.toString());
      const data = await response.json().catch(() => ({}));
      const stops = data.stops || [];
      document.getElementById('undeliveredStops').innerHTML = stops.length
        ? '<table><thead><tr><th>Date</th><th>Route</th><th>Account</th><th>Address</th><th>Reason</th><th>Driver</th><th>Disposition</th><th></th></tr></thead><tbody>' +
          stops.map(stop => '<tr>' +
            '<td>' + escapeHtml(stop.routeDate || '') + '</td>' +
            '<td><strong>' + escapeHtml(stop.routeNumber || '') + '</strong><br><span class="muted">Stop ' + escapeHtml(stop.stopSequence) + '</span></td>' +
            '<td><strong>' + escapeHtml(stop.accountName || '') + '</strong><br><span class="muted">' + escapeHtml(stop.accountNumber || '') + '</span></td>' +
            '<td>' + escapeHtml([stop.destinationAddress, stop.city, stop.stateCode, stop.postalCode].filter(Boolean).join(', ')) + '</td>' +
            '<td>' + escapeHtml(NON_DELIVERY_REASON_LABELS[stop.nonDeliveryReason] || stop.nonDeliveryReason || '-') + (stop.nonDeliveryNotes ? '<br><span class="muted">' + escapeHtml(stop.nonDeliveryNotes) + '</span>' : '') + '</td>' +
            '<td>' + escapeHtml(stop.assignedDriverName || stop.assignedDriverId || '') + '</td>' +
            '<td><span class="status-pill">' + escapeHtml(stop.redeliveryStatus || 'pending') + '</span>' + (stop.redeliveryDate ? '<br><span class="muted">' + escapeHtml(stop.redeliveryDate) + '</span>' : '') + '</td>' +
            '<td><div class="row-actions">' +
              '<button class="warning" onclick="updateUndeliveredDisposition(decodeURIComponent(\\'' + encodeURIComponent(stop.id) + '\\'), \\'redelivery_scheduled\\')">Schedule Redelivery</button>' +
              '<button class="danger" onclick="updateUndeliveredDisposition(decodeURIComponent(\\'' + encodeURIComponent(stop.id) + '\\'), \\'cancelled\\')">Cancel Delivery</button>' +
            '</div></td>' +
          '</tr>').join('') +
          '</tbody></table>'
        : '<p class="muted">No undelivered stops match this filter.</p>';
    }
    loadDriversForAssignment();
    loadRoutes();
    loadUndeliveredStops();
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
    const savedOrders = [];
    for (const manifest of importResult.manifests) {
      const savedManifest = await repositories.upsertDailyRouteManifest(manifest);
      const savedStops = await repositories.replaceDailyRouteStops(savedManifest.id, manifest.stops);
      const savedStopsById = new Map(savedStops.map((stop) => [stop.id, stop]));

      for (const stop of manifest.stops) {
        const order = stop.order || {};
        if (!stop.accountNumber || (!order.invoiceNumber && !order.items?.length)) continue;

        const savedStop = savedStopsById.get(stop.id);
        const savedOrder = await repositories.createAccountOrder({
          id: order.invoiceNumber ? `order_${stableId([stop.accountNumber, order.invoiceNumber])}` : undefined,
          accountNumber: stop.accountNumber,
          accountName: stop.accountName,
          invoiceNumber: order.invoiceNumber || null,
          orderDate: order.orderDate || manifest.routeDate,
          deliveryDate: order.deliveryDate || manifest.routeDate,
          routeManifestId: savedManifest.id,
          routeStopId: savedStop?.id || stop.id,
          status: 'planned',
          items: order.items || [],
          raw: {
            source: 'route_manifest_import',
            routeDate: manifest.routeDate,
            routeNumber: manifest.routeNumber,
            stopSequence: stop.stopSequence
          }
        });
        savedOrders.push(savedOrder);
      }

      savedRoutes.push({ ...savedManifest, stops: savedStops });
    }

    return res.json({
      ok: true,
      summary: {
        ...importResult.summary,
        orders: savedOrders.length,
        orderItems: savedOrders.reduce((sum, order) => sum + (order.items?.length || 0), 0)
      },
      warnings: importResult.warnings,
      orders: savedOrders,
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

    const route = await repositories.getDailyRouteManifest(updatedStop.manifestId);
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

router.post('/driver/stops/:stopId/deductions', driverAuth.requireDriverAuth, async (req, res) => {
  try {
    const identity = driverAuth.getDriverIdentity(req);
    const deduction = await repositories.recordDeliveryDeductionForDriverStop(
      req.params.stopId,
      identity.driverId,
      req.body || {}
    );

    if (!deduction) {
      return res.status(404).json({
        error: 'Assigned route stop not found for this driver.'
      });
    }

    return res.status(201).json({
      ok: true,
      driver: identity,
      deduction
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to record delivery deduction.'
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

router.get('/undelivered', requireAdminSession, async (req, res) => {
  try {
    const stops = await repositories.listUndeliveredRouteStops({
      routeDate: req.query.routeDate,
      redeliveryStatus: req.query.redeliveryStatus,
      limit: req.query.limit
    });
    return res.json({ ok: true, stops });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to list undelivered route stops.'
    });
  }
});

router.put('/undelivered/:stopId/disposition', requireAdminSession, async (req, res) => {
  try {
    const stop = await repositories.updateUndeliveredStopDisposition(req.params.stopId, {
      ...req.body,
      updatedBy: req.adminSession?.username || req.body?.updatedBy
    });
    if (!stop) return res.status(404).json({ error: 'Undelivered stop not found.' });
    return res.json({ ok: true, stop });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || 'Unable to update undelivered stop disposition.'
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
    const driverId = String(req.body?.driverId || req.body?.driver_id || '').trim();
    const driver = await repositories.getDriver(driverId);
    if (!driver || driver.active !== true) {
      return res.status(400).json({
        error: 'The selected driver is not registered as active. Add or reactivate the driver in Driver Registry first.'
      });
    }

    const route = await repositories.assignDailyRouteManifest(req.params.id, {
      ...req.body,
      driverId: driver.driverId,
      driverName: driver.driverName,
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
