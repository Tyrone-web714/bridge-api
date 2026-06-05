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

const SERVICE_AREA_STATES = [
  { code: 'TX', name: 'Texas' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'AR', name: 'Arkansas' }
];

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

function isRegionalAdministrator(session) {
  return ['admin', 'regional_admin', 'regional'].includes(
    cleanText(session?.role || '', 40).toLowerCase()
  );
}

function uniqueSorted(values) {
  return [...new Set(values.map((value) => cleanText(value, 200)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function summarizeDimension(signals, key) {
  const summary = {};
  for (const signal of signals) {
    const label = cleanText(signal[key] || 'Unspecified', 200) || 'Unspecified';
    const current = summary[label] || { count: 0, totalWeight: 0 };
    current.count += 1;
    current.totalWeight += Number(signal.weight) || 0;
    summary[label] = current;
  }
  return Object.entries(summary)
    .map(([label, values]) => ({
      label,
      count: values.count,
      totalWeight: Math.round(values.totalWeight * 10) / 10
    }))
    .sort((left, right) => right.totalWeight - left.totalWeight || left.label.localeCompare(right.label));
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
    categories,
    byState: summarizeDimension(signals, 'stateCode'),
    byTerritory: summarizeDimension(signals, 'territory')
  };
}

function buildFilterOptions(geography, filters = {}) {
  const cities = Array.isArray(geography?.cities) ? geography.cities : [];
  return {
    states: SERVICE_AREA_STATES,
    cities: filters.stateCode
      ? cities.filter((city) => city.stateCode === filters.stateCode)
      : cities,
    territories: Array.isArray(geography?.territories) ? geography.territories : [],
    routeGroups: Array.isArray(geography?.routeGroups) ? geography.routeGroups : [],
    distributionCenters: Array.isArray(geography?.distributionCenters)
      ? geography.distributionCenters
      : [],
    censusPlacesAvailable: Boolean(geography?.censusPlacesAvailable)
  };
}

function buildAccess(session, signals, geography = {}) {
  const regionalAccess = isRegionalAdministrator(session);
  const geographyStateCodes = Array.isArray(geography.cities)
    ? geography.cities.map((city) => city.stateCode)
    : [];
  const coordinates = signals
    .filter((signal) => Number.isFinite(signal.latitude) && Number.isFinite(signal.longitude))
    .map((signal) => [signal.latitude, signal.longitude]);
  return {
    mode: regionalAccess ? 'regional' : 'supervisor_team',
    role: cleanText(session?.role || 'supervisor', 40),
    username: cleanText(session?.username || 'supervisor', 80),
    regionalAccess,
    permittedStates: regionalAccess
      ? SERVICE_AREA_STATES.map((state) => state.code)
      : uniqueSorted([
        ...geographyStateCodes,
        ...signals.map((signal) => signal.stateCode)
      ]),
    teamNames: uniqueSorted([
      ...(Array.isArray(geography.teamNames) ? geography.teamNames : []),
      ...signals.map((signal) => signal.teamName)
    ]),
    defaultBounds: coordinates.length ? coordinates : null
  };
}

function filterSignals(signals, filters) {
  const matches = (actual, expected) => !expected ||
    cleanText(actual, 200).toLowerCase() === cleanText(expected, 200).toLowerCase();
  return signals.filter((signal) => (
    matches(signal.stateCode, filters.stateCode) &&
    matches(signal.city, filters.city) &&
    matches(signal.territory, filters.territory) &&
    matches(signal.routeGroup, filters.routeGroup) &&
    matches(signal.distributionCenter, filters.distributionCenter)
  ));
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
      --panel: rgba(7, 20, 30, 0.94);
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
    .signed-in { margin-left: 10px; color: var(--muted); font-size: 12px; font-weight: 800; }
    button.primary { color: #03151c; background: var(--cyan); border: 0; }
    button:disabled { cursor: wait; opacity: 0.65; }
    .workspace { min-height: calc(100vh - 104px); display: grid; grid-template-columns: minmax(300px, 370px) 1fr; }
    aside { padding: 20px; border-right: 1px solid var(--line); background: var(--panel); overflow-y: auto; }
    .control-group { display: grid; gap: 10px; margin-bottom: 22px; }
    .section-title { margin: 0; font-size: 15px; }
    label { display: grid; gap: 6px; color: var(--muted); font-size: 13px; font-weight: 800; }
    input, select {
      width: 100%; border: 1px solid var(--line); border-radius: 10px; padding: 11px;
      color: var(--text); background: #102536; font: inherit;
    }
    select { color-scheme: dark; }
    select option { color: #f3fbff; background: #102536; }
    .scope {
      padding: 12px; border-left: 4px solid var(--cyan); border-radius: 8px;
      color: #d9f9ff; background: rgba(25,211,230,0.1); font-size: 13px; line-height: 1.45;
    }
    .layer-option {
      display: grid; grid-template-columns: 22px 14px 1fr auto; align-items: center; gap: 9px;
      padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    .layer-option input { width: 18px; height: 18px; }
    .swatch { width: 12px; height: 12px; border-radius: 3px; }
    .layer-count { color: var(--muted); font-size: 12px; font-weight: 900; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .metric, .details-card {
      padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,0.06);
    }
    .metric span { display: block; color: var(--muted); font-size: 11px; font-weight: 900; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 5px; font-size: 22px; }
    .summary-list { display: grid; gap: 7px; margin-top: 8px; }
    .summary-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; color: var(--muted); font-size: 12px; }
    .summary-row strong { color: var(--text); }
    .point-grid { display: grid; gap: 8px; margin-top: 10px; }
    .point-row { display: grid; gap: 2px; }
    .point-row span { color: var(--cyan); font-size: 10px; font-weight: 900; text-transform: uppercase; }
    .point-row strong { overflow-wrap: anywhere; font-size: 13px; }
    .analysis-grid { display: grid; gap: 10px; margin-top: 10px; }
    .analysis-block {
      padding: 11px; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
      background: rgba(255,255,255,0.045);
    }
    .analysis-block h3 { margin: 0 0 7px; color: var(--cyan); font-size: 12px; text-transform: uppercase; }
    .analysis-block ul { margin: 0; padding-left: 18px; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .analysis-block li + li { margin-top: 5px; }
    .analysis-summary { color: var(--text); font-size: 13px; line-height: 1.5; }
    .analysis-meta { margin-bottom: 9px; color: var(--muted); font-size: 11px; font-weight: 800; text-transform: uppercase; }
    #map { min-height: calc(100vh - 104px); background: #102536; }
    .status { margin-top: 14px; color: var(--muted); font-size: 13px; }
    .leaflet-popup-content-wrapper, .leaflet-popup-tip { color: var(--text); background: #102536; }
    .leaflet-popup-content { min-width: 250px; margin: 14px 16px; }
    .popup-title { color: var(--cyan); font-weight: 900; margin-bottom: 9px; }
    .popup-grid { display: grid; gap: 7px; }
    .popup-row { display: grid; gap: 1px; }
    .popup-row span { color: #82dfea; font-size: 10px; font-weight: 900; text-transform: uppercase; }
    .popup-row strong { color: #f3fbff; overflow-wrap: anywhere; font-size: 12px; }
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
      <div><a class="pill" href="/api/admin">Supervisor Dashboard</a> <span class="signed-in">Signed in: ${username}</span></div>
      <h1>Operational Heatmaps</h1>
      <p>Recorded operational signals only. Geographic access is derived from administrator role or supervisor driver-team assignments.</p>
      <p><a class="pill" href="/api/operational-geography/admin">Configure Operational Geography</a></p>
    </div>
  </header>
  <main class="workspace">
    <aside>
      <div id="accessScope" class="scope">Loading permitted operating area...</div>
      <div class="control-group" style="margin-top:18px">
        <strong class="section-title">Geographic Refinement</strong>
        <label>State / Area<select id="stateCode"><option value="">All permitted states</option></select></label>
        <label>City<select id="city"><option value="">All cities</option></select></label>
        <label>Territory<select id="territory"><option value="">All territories</option></select></label>
        <label>Route Group<select id="routeGroup"><option value="">All route groups</option></select></label>
        <label>Distribution Center<select id="distributionCenter"><option value="">All distribution centers</option></select></label>
      </div>
      <div class="control-group">
        <strong class="section-title">Time Range</strong>
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
        <strong class="section-title">Signal Layers</strong>
        <div id="layerControls"></div>
      </div>
      <div class="metrics">
        <div class="metric"><span>Visible Signals</span><strong id="signalCount">0</strong></div>
        <div class="metric"><span>Total Weight</span><strong id="totalWeight">0</strong></div>
      </div>
      <div class="control-group" style="margin-top:22px">
        <strong class="section-title">Area Summary</strong>
        <div id="geographicSummary" class="details-card">No summary loaded.</div>
      </div>
      <div class="control-group">
        <strong class="section-title">Supervisor Intelligence</strong>
        <button class="primary" id="analyzeButton" type="button">Analyze Current View</button>
        <div id="analysisResult" class="details-card">
          Select the desired area and signal layers, then request an AI analysis of this exact view.
        </div>
      </div>
      <div class="control-group">
        <strong class="section-title">Selected Map Point</strong>
        <div id="selectedSignal" class="details-card">Select a colored point on the map to inspect its recorded details.</div>
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
    const stateViews = {
      TX: { bounds: [[25.84, -106.65], [36.50, -93.51]] },
      OK: { bounds: [[33.62, -103.00], [37.00, -94.43]] },
      NM: { bounds: [[31.33, -109.05], [37.00, -103.00]] },
      AR: { bounds: [[33.00, -94.62], [36.50, -89.64]] }
    };
    const fourStateBounds = [[25.8, -109.1], [37.1, -89.6]];
    const map = L.map('map', { zoomControl: true }).fitBounds(fourStateBounds, { padding: [24, 24] });
    map.createPane('heatPane');
    map.getPane('heatPane').style.zIndex = 350;
    map.getPane('heatPane').style.pointerEvents = 'none';
    map.createPane('signalPane');
    map.getPane('signalPane').style.zIndex = 650;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let signals = [];
    let renderedLayers = [];
    let latestAccess = null;
    let latestFilterOptions = {};

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, function (character) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
      });
    }

    function displayValue(value, fallback) {
      const cleaned = String(value ?? '').trim();
      return cleaned || fallback || 'Not recorded';
    }

    function formatDateTime(value) {
      if (!value) return 'Not recorded';
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
    }

    function pointRows(signal, config) {
      return [
        ['Signal Category', config.label],
        ['Signal Type', displayValue(signal.signalType)],
        ['Account / Destination', displayValue(signal.accountName || signal.accountNumber || signal.destinationAddress)],
        ['Address', displayValue(signal.destinationAddress)],
        ['Route Number', displayValue(signal.routeNumber)],
        ['Event Weight', Number(signal.weight || 0).toFixed(1)],
        ['Date and Time', formatDateTime(signal.occurredAt)]
      ];
    }

    function renderPointDetails(signal, config) {
      return '<div class="point-grid">' + pointRows(signal, config).map(function (row) {
        return '<div class="point-row"><span>' + escapeHtml(row[0]) + '</span><strong>' +
          escapeHtml(row[1]) + '</strong></div>';
      }).join('') + '</div>';
    }

    function renderPopup(signal, config) {
      return '<div class="popup-title">Recorded Operational Signal</div><div class="popup-grid">' +
        pointRows(signal, config).map(function (row) {
          return '<div class="popup-row"><span>' + escapeHtml(row[0]) + '</span><strong>' +
            escapeHtml(row[1]) + '</strong></div>';
        }).join('') + '</div>';
    }

    function renderAnalysisList(title, items) {
      const rows = Array.isArray(items) ? items.filter(Boolean) : [];
      return '<div class="analysis-block"><h3>' + escapeHtml(title) + '</h3>' +
        (rows.length
          ? '<ul>' + rows.map(function (item) {
              return '<li>' + escapeHtml(item) + '</li>';
            }).join('') + '</ul>'
          : '<div class="status">No findings recorded.</div>') +
        '</div>';
    }

    function renderAnalysis(data) {
      const ai = data.ai || {};
      const source = data.sourceSummary || {};
      const result = document.getElementById('analysisResult');
      result.innerHTML =
        '<div class="analysis-meta">Severity: ' + escapeHtml(ai.hotspotSeverity || 'unknown') +
          ' | Confidence: ' + escapeHtml(ai.confidence || 'unknown') +
          ' | Signals analyzed: ' + escapeHtml(source.signalCount || 0) + '</div>' +
        '<div class="analysis-summary"><strong>' +
          escapeHtml(ai.title || 'Operational Hotspot Analysis') + '</strong><br />' +
          escapeHtml(ai.summary || 'No analysis summary returned.') + '</div>' +
        '<div class="analysis-grid">' +
          renderAnalysisList('High-Priority Areas', ai.highPriorityAreas) +
          renderAnalysisList('Category Patterns', ai.categoryPatterns) +
          renderAnalysisList('Recurring Signals', ai.recurringSignals) +
          renderAnalysisList('Recommended Supervisor Actions', ai.supervisorActions) +
          renderAnalysisList('Missing Data', ai.missingData) +
        '</div>';
    }

    function populateSelect(id, options, placeholder, valueKey, labelKey, emptyLabel) {
      const select = document.getElementById(id);
      const previous = select.value;
      const items = Array.isArray(options) ? options : [];
      select.innerHTML = '<option value="">' + escapeHtml(placeholder) + '</option>' +
        items.map(function (item) {
          const value = typeof item === 'string' ? item : item[valueKey || 'value'];
          const label = typeof item === 'string' ? item : item[labelKey || 'label'];
          return '<option value="' + escapeHtml(value) + '">' + escapeHtml(label) + '</option>';
        }).join('') +
        (!items.length && emptyLabel
          ? '<option value="" disabled>' + escapeHtml(emptyLabel) + '</option>'
          : '');
      if ([...select.options].some(function (option) { return option.value === previous; })) {
        select.value = previous;
      }
    }

    function buildLayerControls(summary) {
      const container = document.getElementById('layerControls');
      container.innerHTML = Object.entries(categoryConfig).map(function (entry) {
        const category = entry[0];
        const config = entry[1];
        const count = summary.categories && summary.categories[category] ? summary.categories[category].count : 0;
        return '<label class="layer-option">' +
          '<input type="checkbox" data-category="' + category + '"' +
            (activeCategories.has(category) ? ' checked' : '') + ' />' +
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

    function renderGeographicSummary(summary, access) {
      const primary = access && access.regionalAccess ? summary.byState : summary.byTerritory;
      const title = access && access.regionalAccess ? 'State overview' : 'Territory overview';
      const rows = Array.isArray(primary) ? primary : [];
      document.getElementById('geographicSummary').innerHTML =
        '<strong>' + escapeHtml(title) + '</strong>' +
        '<div class="summary-list">' +
          (rows.length ? rows.map(function (entry) {
            return '<div class="summary-row"><span>' + escapeHtml(entry.label) + '</span>' +
              '<strong>' + entry.count + ' signals / ' + Number(entry.totalWeight || 0).toFixed(1) + '</strong></div>';
          }).join('') : '<span class="status">No recorded signals for this selection.</span>') +
        '</div>';
    }

    function renderAccess(access) {
      latestAccess = access || {};
      const states = (latestAccess.permittedStates || []).join(', ') || 'No recorded state';
      const teams = (latestAccess.teamNames || []).join(', ');
      document.getElementById('accessScope').textContent = latestAccess.regionalAccess
        ? 'Regional administrator view: Texas, Oklahoma, New Mexico, and Arkansas.'
        : 'Supervisor team view for ' + displayValue(latestAccess.username, 'current supervisor') +
          '. Permitted states: ' + states + (teams ? '. Teams: ' + teams : '.');
    }

    function clearRenderedLayers() {
      for (const layer of renderedLayers) map.removeLayer(layer);
      renderedLayers = [];
    }

    function frameOperatingArea(bounds, fitMap) {
      if (!fitMap) return;
      const stateCode = document.getElementById('stateCode').value;
      const city = document.getElementById('city').value;
      if (city) {
        const cityOption = (latestFilterOptions.cities || []).find(function (item) {
          return item.value === city && (!stateCode || item.stateCode === stateCode);
        });
        if (cityOption && Number.isFinite(Number(cityOption.latitude)) &&
            Number.isFinite(Number(cityOption.longitude))) {
          map.flyTo([Number(cityOption.latitude), Number(cityOption.longitude)], 12, {
            animate: true,
            duration: 0.7
          });
          return;
        }
        if (bounds.length === 1) {
          map.flyTo(bounds[0], 13, { animate: true, duration: 0.7 });
          return;
        }
        if (bounds.length > 1) {
          map.flyToBounds(bounds, { padding: [42, 42], maxZoom: 13, duration: 0.7 });
          return;
        }
      }
      if (stateCode && stateViews[stateCode]) {
        map.flyToBounds(stateViews[stateCode].bounds, {
          padding: [18, 18],
          maxZoom: 8,
          duration: 0.8
        });
        return;
      }
      if (bounds.length === 1) {
        map.flyTo(bounds[0], 13, { animate: true, duration: 0.7 });
        return;
      }
      if (bounds.length > 1) {
        map.flyToBounds(bounds, { padding: [34, 34], maxZoom: 14, duration: 0.7 });
        return;
      }
      if (latestAccess && !latestAccess.regionalAccess && Array.isArray(latestAccess.defaultBounds) &&
          latestAccess.defaultBounds.length) {
        map.fitBounds(latestAccess.defaultBounds, { padding: [34, 34], maxZoom: 12 });
        return;
      }
      map.fitBounds(fourStateBounds, { padding: [24, 24] });
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
          pane: 'heatPane',
          radius: 28,
          blur: 22,
          minOpacity: 0.34,
          maxZoom: 17,
          gradient: { 0.25: config.color, 0.6: config.color, 1: '#ffffff' }
        }).addTo(map);
        renderedLayers.push(heat);

        for (const signal of categorySignals) {
          const marker = L.circleMarker([signal.latitude, signal.longitude], {
            pane: 'signalPane',
            radius: Math.min(12, 6 + Number(signal.weight || 1) / 2),
            color: '#ffffff',
            weight: 2,
            fillColor: config.color,
            fillOpacity: 0.92,
            interactive: true,
            bubblingMouseEvents: false
          })
            .bindPopup(renderPopup(signal, config), { maxWidth: 330 })
            .bindTooltip(config.label + ': ' +
              displayValue(signal.accountName || signal.destinationAddress || signal.signalType), {
                direction: 'top',
                opacity: 0.95
              })
            .on('click', function () {
              document.getElementById('selectedSignal').innerHTML = renderPointDetails(signal, config);
            })
            .addTo(map);
          renderedLayers.push(marker);
        }
      }

      document.getElementById('signalCount').textContent = visible.length;
      document.getElementById('totalWeight').textContent = visible
        .reduce(function (sum, signal) { return sum + Number(signal.weight || 0); }, 0)
        .toFixed(1);
      frameOperatingArea(bounds, fitMap);
    }

    function currentParams() {
      const params = new URLSearchParams({
        periodDays: document.getElementById('periodDays').value
      });
      for (const id of ['stateCode', 'city', 'territory', 'routeGroup', 'distributionCenter']) {
        const value = document.getElementById(id).value;
        if (value) params.set(id, value);
      }
      const routeDate = document.getElementById('routeDate').value;
      if (routeDate) params.set('routeDate', routeDate);
      return params;
    }

    function currentAnalysisPayload() {
      const payload = {
        periodDays: Number(document.getElementById('periodDays').value || 30),
        categories: [...activeCategories]
      };
      for (const id of ['stateCode', 'city', 'territory', 'routeGroup', 'distributionCenter']) {
        const value = document.getElementById(id).value;
        if (value) payload[id] = value;
      }
      const routeDate = document.getElementById('routeDate').value;
      if (routeDate) payload.routeDate = routeDate;
      return payload;
    }

    async function analyzeCurrentView() {
      const button = document.getElementById('analyzeButton');
      const result = document.getElementById('analysisResult');
      if (!activeCategories.size) {
        result.textContent = 'Select at least one signal layer before requesting analysis.';
        return;
      }
      button.disabled = true;
      result.textContent = 'Analyzing the currently selected area and visible signal layers...';
      try {
        const response = await fetch('/api/ai/operational-heatmap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentAnalysisPayload())
        });
        const data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || 'Operational analysis request failed.');
        renderAnalysis(data);
      } catch (error) {
        result.textContent = error.message || 'Operational analysis request failed.';
      } finally {
        button.disabled = false;
      }
    }

    async function loadSignals() {
      const button = document.getElementById('refreshButton');
      const status = document.getElementById('status');
      button.disabled = true;
      status.textContent = 'Loading authorized operational signals...';
      try {
        const response = await fetch('/api/operational-heatmaps/data?' + currentParams().toString());
        const data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || 'Heatmap request failed.');
        signals = Array.isArray(data.signals) ? data.signals : [];
        latestFilterOptions = data.filterOptions || {};
        renderAccess(data.access);
        populateSelect(
          'stateCode',
          data.filterOptions && data.filterOptions.states,
          'All four service states',
          'code',
          'name'
        );
        populateSelect(
          'city',
          data.filterOptions && data.filterOptions.cities,
          'All cities',
          'value',
          'label',
          document.getElementById('stateCode').value
            ? 'No Census or route cities available for this state'
            : 'Select a state to load its cities'
        );
        populateSelect(
          'territory',
          data.filterOptions && data.filterOptions.territories,
          'All territories',
          null,
          null,
          'No territories configured in Driver Registry'
        );
        populateSelect(
          'routeGroup',
          data.filterOptions && data.filterOptions.routeGroups,
          'All route groups',
          null,
          null,
          'No route groups configured in Driver Registry'
        );
        populateSelect(
          'distributionCenter',
          data.filterOptions && data.filterOptions.distributionCenters,
          'All distribution centers',
          null,
          null,
          'No distribution centers recorded in route manifests'
        );
        buildLayerControls(data.summary || { categories: {} });
        renderGeographicSummary(data.summary || {}, data.access || {});
        document.getElementById('selectedSignal').textContent =
          'Select a colored point on the map to inspect its recorded details.';
        renderSignals(true);
        status.textContent = signals.length
          ? 'Showing authorized source-of-truth signals. Select any colored point for full details.'
          : 'No geocoded operational signals were recorded for this selection.';
      } catch (error) {
        clearRenderedLayers();
        status.textContent = error.message || 'Heatmap request failed.';
      } finally {
        button.disabled = false;
      }
    }

    document.getElementById('refreshButton').addEventListener('click', loadSignals);
    document.getElementById('analyzeButton').addEventListener('click', analyzeCurrentView);
    const geographicHierarchy = [
      'stateCode',
      'city',
      'territory',
      'routeGroup',
      'distributionCenter'
    ];
    geographicHierarchy.forEach(function (id, index) {
      document.getElementById(id).addEventListener('change', function () {
        geographicHierarchy.slice(index + 1).forEach(function (downstreamId) {
          document.getElementById(downstreamId).value = '';
        });
        loadSignals();
      });
    });
    document.getElementById('routeDate').addEventListener('change', loadSignals);
    document.getElementById('periodDays').addEventListener('change', loadSignals);
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
    const regionalAccess = isRegionalAdministrator(req.adminSession);
    const supervisorUsername = regionalAccess ? null : cleanText(req.adminSession.username, 120).toLowerCase();
    const filters = {
      stateCode: cleanText(req.query?.stateCode || req.query?.state_code, 8).toUpperCase(),
      city: cleanText(req.query?.city, 160),
      territory: cleanText(req.query?.territory, 160),
      routeGroup: cleanText(req.query?.routeGroup || req.query?.route_group, 160),
      distributionCenter: cleanText(
        req.query?.distributionCenter || req.query?.distribution_center,
        200
      )
    };

    const [authorizedSignals, geography] = await Promise.all([
      repositories.listOperationalHeatmapSignals({
        routeDate,
        periodDays,
        supervisorUsername,
        limit: 5000
      }),
      repositories.listOperationalHeatmapGeography({
        supervisorUsername,
        stateCode: filters.stateCode
      })
    ]);
    const access = buildAccess(req.adminSession, authorizedSignals, geography);
    const filterOptions = buildFilterOptions(geography, filters);
    const signals = filterSignals(authorizedSignals, filters);

    return res.json({
      ok: true,
      routeDate,
      periodDays,
      filters,
      access,
      filterOptions,
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
