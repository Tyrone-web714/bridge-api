const express = require('express');
const adminAuth = require('../services/adminAuth');
const repositories = require('../db/repositories');

const router = express.Router();

const CATEGORY_CONFIG = {
  delay: { label: 'Delivery Delays', color: '#ffbf3f' },
  delivery_failure: { label: 'Delivery Failures', color: '#ff4d5e' },
  deduction: { label: 'Deductions', color: '#c084fc' },
  hazard: { label: 'Hazard Events', color: '#ff7a18' },
  route_event: { label: 'Route Events', color: '#19d3e6' },
  revenue: { label: 'Recorded Revenue', color: '#55e08a' }
};

function requireAdminSession(req, res, next) {
  const session = adminAuth.getAdminSession(req);
  if (!session) {
    if (req.accepts('html')) return res.redirect('/api/routing/manual-hazards/admin/login');
    return res.status(401).json({ ok: false, error: 'Supervisor admin login required.' });
  }
  req.adminSession = session;
  return next();
}

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizePeriodDays(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(parsed, 1), 365);
}

function normalizeRouteDate(value) {
  const cleaned = cleanText(value, 40);
  return /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

function buildSummary(signals) {
  const categories = {};
  let totalWeight = 0;
  for (const signal of signals) {
    const category = signal.category || 'route_event';
    const current = categories[category] || { count: 0, totalWeight: 0 };
    current.count += 1;
    current.totalWeight += Number(signal.weight) || 0;
    categories[category] = current;
    totalWeight += Number(signal.weight) || 0;
  }
  for (const category of Object.values(categories)) {
    category.totalWeight = Math.round(category.totalWeight * 10) / 10;
  }
  return {
    signalCount: signals.length,
    totalWeight: Math.round(totalWeight * 10) / 10,
    categories
  };
}

function renderHeatmapPage(session) {
  const username = cleanText(session?.username || 'supervisor', 80);
  const categoryJson = JSON.stringify(CATEGORY_CONFIG).replace(/</g, '\\u003c');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truck-Safe Operational Heatmaps</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    :root {
      color-scheme: dark;
      --bg: #061019;
      --panel: rgba(7, 20, 30, 0.9);
      --line: rgba(255,255,255,0.16);
      --text: #f3fbff;
      --muted: #a9bdc7;
      --cyan: #19d3e6;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: Arial, sans-serif; color: var(--text); background: var(--bg); }
    header {
      display: flex; justify-content: space-between; align-items: center; gap: 18px; flex-wrap: wrap;
      padding: 20px clamp(18px, 3vw, 38px); border-bottom: 1px solid var(--line);
      background: linear-gradient(110deg, rgba(217,33,46,0.22), rgba(25,211,230,0.16));
    }
    h1 { margin: 0; font-size: clamp(28px, 4vw, 46px); letter-spacing: 0; }
    p { color: var(--muted); line-height: 1.4; }
    a, button { font: inherit; }
    .pill, button {
      border: 1px solid var(--line); border-radius: 999px; padding: 10px 14px;
      color: var(--text); background: rgba(255,255,255,0.09); text-decoration: none; font-weight: 900; cursor: pointer;
    }
    button.primary { color: #03151c; background: var(--cyan); border: 0; }
    .workspace { min-height: calc(100vh - 104px); display: grid; grid-template-columns: minmax(270px, 340px) 1fr; }
    aside { padding: 20px; border-right: 1px solid var(--line); background: var(--panel); overflow-y: auto; }
    .control-group { display: grid; gap: 10px; margin-bottom: 22px; }
    label { display: grid; gap: 6px; color: var(--muted); font-size: 13px; font-weight: 800; }
    input, select {
      width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 11px;
      color: var(--text); background: rgba(255,255,255,0.07); font: inherit;
    }
    .layer-option {
      display: grid; grid-template-columns: 22px 14px 1fr auto; align-items: center; gap: 9px;
      padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .layer-option input { width: 18px; height: 18px; }
    .swatch { width: 12px; height: 12px; border-radius: 3px; }
    .layer-count { color: var(--muted); font-size: 12px; font-weight: 900; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .metric { padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,0.06); }
    .metric span { display: block; color: var(--muted); font-size: 11px; font-weight: 900; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 5px; font-size: 22px; }
    #map { min-height: calc(100vh - 104px); background: #102536; }
    .status { margin-top: 14px; color: var(--muted); font-size: 13px; }
    .leaflet-popup-content-wrapper, .leaflet-popup-tip { color: var(--text); background: #102536; }
    .popup-title { font-weight: 900; margin-bottom: 5px; }
    .popup-meta { color: #bdd0d9; font-size: 12px; line-height: 1.4; }
    @media (max-width: 820px) {
      .workspace { grid-template-columns: 1fr; }
      aside { border-right: 0; border-bottom: 1px solid var(--line); }
      #map { min-height: 68vh; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <div><a class="pill" href="/api/admin">Supervisor Dashboard</a> <span class="pill">${username}</span></div>
      <h1>Operational Heatmaps</h1>
      <p>Recorded operational signals only. Toggle layers to isolate recurring delay, failure, deduction, hazard, route-event, and revenue concentration.</p>
    </div>
  </header>
  <main class="workspace">
    <aside>
      <div class="control-group">
        <label>Specific Route Date (optional)<input id="routeDate" type="date" /></label>
        <label>Historical Lookback
          <select id="periodDays">
            <option value="7">7 days</option>
            <option value="30" selected>30 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">365 days</option>
          </select>
        </label>
        <button class="primary" id="refreshButton" type="button">Refresh Map</button>
      </div>
      <div class="control-group">
        <strong>Signal Layers</strong>
        <div id="layerControls"></div>
      </div>
      <div class="metrics">
        <div class="metric"><span>Visible Signals</span><strong id="signalCount">0</strong></div>
        <div class="metric"><span>Total Weight</span><strong id="totalWeight">0</strong></div>
      </div>
      <div id="status" class="status">Loading operational signals...</div>
    </aside>
    <div id="map" aria-label="Operational heatmap"></div>
  </main>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
  <script>
    const categoryConfig = ${categoryJson};
    const activeCategories = new Set(Object.keys(categoryConfig));
    const map = L.map('map', { zoomControl: true }).setView([29.4241, -98.4936], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let signals = [];
    let renderedLayers = [];

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, function (character) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
      });
    }

    function buildLayerControls(summary) {
      const container = document.getElementById('layerControls');
      container.innerHTML = Object.entries(categoryConfig).map(function (entry) {
        const category = entry[0];
        const config = entry[1];
        const count = summary.categories?.[category]?.count || 0;
        return '<label class="layer-option">' +
          '<input type="checkbox" data-category="' + category + '" checked />' +
          '<span class="swatch" style="background:' + config.color + '"></span>' +
          '<span>' + escapeHtml(config.label) + '</span>' +
          '<span class="layer-count">' + count + '</span>' +
        '</label>';
      }).join('');
      container.querySelectorAll('input[data-category]').forEach(function (input) {
        input.addEventListener('change', function () {
          if (input.checked) activeCategories.add(input.dataset.category);
          else activeCategories.delete(input.dataset.category);
          renderSignals(false);
        });
      });
    }

    function clearRenderedLayers() {
      for (const layer of renderedLayers) map.removeLayer(layer);
      renderedLayers = [];
    }

    function renderSignals(fitMap) {
      clearRenderedLayers();
      const visible = signals.filter(function (signal) {
        return activeCategories.has(signal.category);
      });
      const bounds = [];

      for (const entry of Object.entries(categoryConfig)) {
        const category = entry[0];
        const config = entry[1];
        if (!activeCategories.has(category)) continue;
        const categorySignals = visible.filter(function (signal) { return signal.category === category; });
        if (!categorySignals.length) continue;
        const heatPoints = categorySignals.map(function (signal) {
          bounds.push([signal.latitude, signal.longitude]);
          return [signal.latitude, signal.longitude, Math.min(1, Math.max(0.15, Number(signal.weight || 1) / 10))];
        });
        const heat = L.heatLayer(heatPoints, {
          radius: 28,
          blur: 22,
          minOpacity: 0.34,
          maxZoom: 17,
          gradient: { 0.25: config.color, 0.6: config.color, 1: '#ffffff' }
        }).addTo(map);
        renderedLayers.push(heat);

        for (const signal of categorySignals) {
          const marker = L.circleMarker([signal.latitude, signal.longitude], {
            radius: Math.min(10, 4 + Number(signal.weight || 1) / 2),
            color: config.color,
            weight: 2,
            fillColor: config.color,
            fillOpacity: 0.68
          }).bindPopup(
            '<div class="popup-title">' + escapeHtml(config.label) + '</div>' +
            '<div class="popup-meta">' +
              escapeHtml(signal.accountName || signal.destinationAddress || signal.signalType || 'Recorded signal') + '<br>' +
              (signal.destinationAddress ? escapeHtml(signal.destinationAddress) + '<br>' : '') +
              (signal.routeNumber ? 'Route ' + escapeHtml(signal.routeNumber) + '<br>' : '') +
              'Weight: ' + escapeHtml(signal.weight) + '<br>' +
              escapeHtml(signal.occurredAt || '') +
            '</div>'
          ).addTo(map);
          renderedLayers.push(marker);
        }
      }

      document.getElementById('signalCount').textContent = visible.length;
      document.getElementById('totalWeight').textContent = visible
        .reduce(function (sum, signal) { return sum + Number(signal.weight || 0); }, 0)
        .toFixed(1);
      if (fitMap && bounds.length) map.fitBounds(bounds, { padding: [34, 34], maxZoom: 14 });
    }

    async function loadSignals() {
      const button = document.getElementById('refreshButton');
      const status = document.getElementById('status');
      button.disabled = true;
      status.textContent = 'Loading operational signals...';
      const params = new URLSearchParams({
        periodDays: document.getElementById('periodDays').value
      });
      const routeDate = document.getElementById('routeDate').value;
      if (routeDate) params.set('routeDate', routeDate);
      try {
        const response = await fetch('/api/operational-heatmaps/data?' + params.toString());
        const data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || 'Heatmap request failed.');
        signals = Array.isArray(data.signals) ? data.signals : [];
        buildLayerControls(data.summary || { categories: {} });
        renderSignals(true);
        status.textContent = signals.length
          ? 'Showing source-of-truth signals from the selected period.'
          : 'No geocoded operational signals were recorded for this period.';
      } catch (error) {
        clearRenderedLayers();
        status.textContent = error.message || 'Heatmap request failed.';
      } finally {
        button.disabled = false;
      }
    }

    document.getElementById('refreshButton').addEventListener('click', loadSignals);
    loadSignals();
  </script>
</body>
</html>`;
}

router.get('/admin', requireAdminSession, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderHeatmapPage(req.adminSession));
});

router.get('/data', requireAdminSession, async (req, res) => {
  try {
    const routeDate = normalizeRouteDate(req.query?.routeDate || req.query?.route_date);
    const periodDays = normalizePeriodDays(req.query?.periodDays || req.query?.period_days);
    const signals = await repositories.listOperationalHeatmapSignals({
      routeDate,
      periodDays,
      limit: 2000
    });
    return res.json({
      ok: true,
      routeDate,
      periodDays,
      generatedAt: new Date().toISOString(),
      categories: CATEGORY_CONFIG,
      summary: buildSummary(signals),
      signals
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.status ? error.message : 'Operational heatmap request failed.'
    });
  }
});

module.exports = router;
