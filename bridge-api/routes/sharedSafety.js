const express = require('express');
const crypto = require('crypto');
const authorization = require('../middleware/authorization');
const adminAuth = require('../services/adminAuth');
const driverAuth = require('../services/driverAuth');
const auditLog = require('../services/auditLog');
const rbac = require('../services/rbac');
const sharedSafety = require('../services/sharedSafety');

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
    .update(`${session.username || 'anonymous'}:${session.sessionVersion ?? 'legacy'}:${session.expiresAt || ''}:shared-safety`)
    .digest('base64url');
}

function requireCsrf(req, res, next) {
  const expected = csrfTokenForSession(req.adminSession || {});
  const presented = String(req.get('x-tsr-admin-csrf') || '');
  if (!presented || presented !== expected) {
    audit(req, 'shared_safety_csrf_denial', 403, { code: 'CSRF_TOKEN_INVALID' });
    return res.status(403).json({ error: 'Invalid admin action token.', code: 'CSRF_TOKEN_INVALID' });
  }
  const contentType = String(req.get('content-type') || '').toLowerCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(req.method || '').toUpperCase())
    && !contentType.includes('application/json')) {
    audit(req, 'shared_safety_invalid_content_type', 415, { code: 'INVALID_CONTENT_TYPE' });
    return res.status(415).json({ error: 'Moderation actions require application/json.', code: 'INVALID_CONTENT_TYPE' });
  }
  return next();
}

function hasBearerToken(req) {
  return /^Bearer\s+/i.test(String(req.get('authorization') || '')) || Boolean(req.get('x-tsr-driver-token'));
}

function hydrateDriverContextIfPresented(req, res, next) {
  if (req.adminSession || req.driverAuth || req.warehouseAuth || !hasBearerToken(req)) return next();
  return driverAuth.requireDriverAuth(req, res, () => {
    req.authContext = authorization.buildAuthContext(req);
    return next();
  });
}

function audit(req, eventType, statusCode, extra = {}) {
  auditLog.recordSecurityEvent(req, {
    eventType,
    statusCode,
    outcome: statusCode >= 200 && statusCode < 400 ? 'success' : 'failure',
    ...extra
  }).catch((error) => {
    console.warn(`shared-safety audit write failed requestId=${req.requestId || 'unknown'}: ${error.message}`);
  });
}

function sendError(req, res, error, fallbackMessage) {
  const status = error.status || 500;
  if (status === 403 && error.code === 'PLATFORM_ADMIN_REQUIRED') {
    audit(req, 'unauthorized_moderation_attempt', 403, { code: error.code });
  }
  return res.status(status).json({
    error: error.message || fallbackMessage,
    code: error.code || 'SHARED_SAFETY_ERROR'
  });
}

function requirePlatformPermission(permission) {
  return [
    authorization.requirePlatformAdmin,
    authorization.requirePermission(permission)
  ];
}

function requirePlatformAdminPage(req, res, next) {
  req.authContext = authorization.buildAuthContext(req);
  if (!req.authContext.authenticated) {
    return res.redirect('/api/routing/manual-hazards/admin/login');
  }
  if (req.authContext.approvedRole !== rbac.ROLES.PLATFORM_ADMIN) {
    audit(req, 'unauthorized_moderation_attempt', 403, { code: 'PLATFORM_ADMIN_REQUIRED' });
    return res.status(403).type('html').send(renderAccessDeniedPage());
  }
  return next();
}

function renderAccessDeniedPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Access Denied</title><style>body{font-family:Arial,sans-serif;background:#061019;color:#f3fbff;margin:0;display:grid;place-items:center;min-height:100vh}.box{max-width:560px;border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:28px;background:rgba(255,255,255,.08)}a{color:#19d3e6;font-weight:900}</style></head><body><div class="box"><h1>Access Denied</h1><p>Shared Safety moderation is restricted to Platform Admin users.</p><p><a href="/api/admin">Return to dashboard</a></p></div></body></html>`;
}

function renderModerationShell(session = {}, mode = 'queue', candidateId = '') {
  const csrfToken = csrfTokenForSession(session);
  const username = escapeHtml(session.displayName || session.username || 'platform-admin');
  const approvedRole = escapeHtml(session.approvedRole || 'PLATFORM_ADMIN');
  const initialCandidateId = escapeHtml(candidateId);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Shared Safety Moderation</title>
  <style>
    :root { color-scheme: light; --red:#d62828; --blue:#1565c0; --line:#cfe2ef; --ink:#102033; --muted:#526b7d; --panel:#ffffff; --soft:#f4f9fc; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:Arial,sans-serif; color:var(--ink); background:linear-gradient(145deg,#dceef8 0%,#f8fbfd 50%,#fff0f3 100%); }
    header { background:linear-gradient(135deg,#7c0b12 0%,#d62828 48%,#0d47a1 100%); color:#fff; padding:18px 22px; display:flex; align-items:center; justify-content:space-between; gap:16px; box-shadow:0 14px 34px rgba(12,38,64,.24); }
    main { max-width:1440px; margin:0 auto; padding:20px; }
    h1,h2,h3 { margin:0 0 12px; }
    .eyebrow { margin:0 0 4px; color:#aee4ff; font-size:12px; font-weight:900; text-transform:uppercase; }
    .subtitle { margin:-4px 0 0; color:#ffe8ec; font-size:14px; font-weight:700; }
    .header-actions,.actions,.row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .role-badge { border-radius:999px; padding:9px 12px; color:#fff; background:rgba(255,255,255,.16); border:1px solid rgba(255,255,255,.36); font-size:12px; font-weight:900; text-transform:uppercase; }
    .logout { background:rgba(255,255,255,.18); color:#fff; border:1px solid rgba(255,255,255,.42); border-radius:999px; padding:10px 12px; font-weight:800; cursor:pointer; }
    .admin-tabs { max-width:1440px; margin:16px auto 0; padding:0 20px; display:flex; gap:10px; flex-wrap:wrap; }
    .tab { min-height:44px; border-radius:999px; padding:0 18px; display:inline-flex; align-items:center; justify-content:center; text-decoration:none; font-weight:900; text-transform:uppercase; font-size:12px; color:#102033; background:rgba(255,255,255,.82); border:2px solid #8fc2df; }
    .tab.active { color:#fff; background:#c8131f; border-color:#fff; }
    section,.panel { background:rgba(255,255,255,.96); border:2px solid var(--line); border-left:8px solid var(--blue); border-radius:16px; padding:16px; margin-bottom:16px; box-shadow:0 12px 30px rgba(12,38,64,.12); }
    .private { border-left-color:#d62828; }
    .shared { border-left-color:#24a148; }
    .audit { border-left-color:#7c3aed; }
    label { display:block; font-size:12px; font-weight:900; color:#0d47a1; text-transform:uppercase; margin:10px 0 4px; }
    input,select,textarea { width:100%; border:2px solid #8fc2df; border-radius:10px; padding:10px; font-size:15px; background:#f7fcff; }
    textarea { min-height:84px; resize:vertical; }
    button { border:0; border-radius:10px; padding:10px 12px; font-weight:900; cursor:pointer; }
    .primary { background:#d62828; color:#fff; }
    .blue { background:#1565c0; color:#fff; }
    .gray { background:#e8f5ff; color:#24506f; }
    .danger { background:#ffe3e3; color:#a11b1b; }
    .gold { background:#fff0c2; color:#7a4f00; }
    .green { background:#dff4e7; color:#146c2e; }
    .filters,.grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; align-items:end; }
    .workspace { display:grid; grid-template-columns:minmax(0,1fr) minmax(420px,.85fr); gap:16px; align-items:start; }
    table { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; overflow:hidden; border-radius:12px; }
    th,td { border-bottom:1px solid #d4e8f6; padding:9px; text-align:left; vertical-align:top; }
    th { color:#fff; background:#0d47a1; text-transform:uppercase; font-size:11px; }
    tr:nth-child(even) td { background:#f7fcff; }
    .pill { display:inline-block; border-radius:999px; padding:3px 8px; font-weight:900; font-size:11px; background:#e8f5ff; color:#24506f; }
    .ok { background:#dff4e7; color:#146c2e; }
    .warn { background:#fff3cd; color:#7a4f00; }
    .bad { background:#ffe3e3; color:#a11b1b; }
    .meta { color:var(--muted); line-height:1.4; font-size:13px; }
    .message { min-height:22px; margin:10px 0; font-weight:900; color:#1565c0; }
    .split { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .map-preview { min-height:230px; border:2px solid #8fc2df; border-radius:12px; background:linear-gradient(135deg,#e8f5ff,#fff); padding:12px; display:grid; gap:10px; align-content:center; }
    .coord-card { border:1px solid #cfe2ef; border-radius:12px; padding:10px; background:#fff; }
    pre { white-space:pre-wrap; word-break:break-word; background:#f7fcff; border:1px solid #d4e8f6; border-radius:10px; padding:10px; margin:0; max-height:220px; overflow:auto; }
    .hidden { display:none; }
    @media (max-width:1100px){ .workspace,.split,.filters,.grid{grid-template-columns:1fr} header{align-items:flex-start;flex-direction:column} }
  </style>
</head>
<body data-mode="${escapeHtml(mode)}" data-candidate-id="${initialCandidateId}">
  <header>
    <div>
      <p class="eyebrow">Platform Administration</p>
      <h1>Shared Safety Moderation</h1>
      <p class="subtitle">Review private hazard submissions, sanitize safety facts, and publish only approved platform-global records.</p>
    </div>
    <div class="header-actions">
      <div class="role-badge">${username} · ${approvedRole}</div>
      <form method="post" action="/api/routing/manual-hazards/admin/logout"><button class="logout" type="submit">Log Out</button></form>
    </div>
  </header>
  <nav class="admin-tabs">
    <a class="tab active" href="/api/shared-safety/admin">Shared Safety Moderation</a>
    <a class="tab" href="/api/routing/manual-hazards/admin">Hazard Review</a>
    <a class="tab" href="/api/routing/hazard-verification/admin">Static Hazard Verification</a>
    <a class="tab" href="/api/admin">Supervisor Dashboard</a>
  </nav>
  <main>
    <div id="message" class="message"></div>
    <section id="queuePanel">
      <h2>Moderation Queue</h2>
      <div class="filters">
        <div><label>Status</label><select id="filterStatus"><option value="pending_review">Pending Review</option><option value="correction_requested">Correction Requested</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="duplicate">Duplicate</option><option value="merged">Merged</option><option value="">All</option></select></div>
        <div><label>Hazard Type</label><select id="filterType"><option value="">All</option><option value="low_bridge">Low bridge</option><option value="truck_restriction">Truck restriction</option><option value="weight_restriction">Weight restriction</option><option value="height_restriction">Height restriction</option><option value="no_truck">No truck</option><option value="dangerous_turn">Dangerous turn</option><option value="hazardous_intersection">Hazardous intersection</option><option value="road_closure">Road closure</option><option value="construction">Construction</option><option value="unsafe_loading_entrance">Unsafe loading entrance</option><option value="unsafe_parking">Unsafe parking</option><option value="residential">Residential</option></select></div>
        <div><label>Severity</label><select id="filterSeverity"><option value="">All</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></div>
        <div><label>Source Organization</label><input id="filterSourceOrg" placeholder="Platform Admin only" /></div>
      </div>
      <div class="filters" style="margin-top:10px">
        <div><label>Submitted From</label><input id="filterSubmittedFrom" placeholder="2026-07-01" /></div>
        <div><label>Submitted To</label><input id="filterSubmittedTo" placeholder="2026-07-31" /></div>
        <div><label>Sort</label><select id="filterSort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="status">Status</option><option value="type">Hazard type</option></select></div>
        <div><label>Limit</label><select id="filterLimit"><option value="100">100</option><option value="50">50</option><option value="25">25</option></select></div>
      </div>
      <div class="actions" style="margin-top:12px"><button class="blue" onclick="loadQueue()">Refresh Queue</button><button class="gray" onclick="loadSharedRecords()">Refresh Shared Records</button></div>
      <div style="overflow-x:auto;margin-top:12px"><table><thead><tr><th>Status</th><th>Type</th><th>Source Organization</th><th>Sanitized</th><th>Submitted</th><th>Linkage</th><th>Actions</th></tr></thead><tbody id="queueRows"></tbody></table></div>
    </section>
    <div id="detailPanel" class="workspace hidden">
      <div>
        <section class="private">
          <h2>Private Source</h2>
          <div id="privateSource"></div>
        </section>
        <section class="shared">
          <h2>Sanitized Shared Record Preview</h2>
          <div class="grid">
            <div><label>Shared hazard type</label><select id="sharedType"><option value="low_bridge">Low bridge</option><option value="truck_restriction">Truck restriction</option><option value="weight_restriction">Weight restriction</option><option value="height_restriction">Height restriction</option><option value="no_truck">No truck</option><option value="dangerous_turn">Dangerous turn</option><option value="hazardous_intersection">Hazardous intersection</option><option value="road_closure">Road closure</option><option value="construction">Construction</option><option value="unsafe_loading_entrance">Unsafe loading entrance</option><option value="unsafe_parking">Unsafe parking</option><option value="residential">Residential</option></select></div>
            <div><label>Severity</label><select id="severity"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select></div>
            <div><label>Latitude</label><input id="sanitizedLatitude" /></div>
            <div><label>Longitude</label><input id="sanitizedLongitude" /></div>
          </div>
          <label>Sanitized description</label><textarea id="sanitizedDescription" placeholder="Only public truck-safety fact. No driver, customer, route, manifest, delivery, KPI, receipt, private media, or internal note details."></textarea>
          <div class="grid">
            <div><label>Effective from</label><input id="effectiveFrom" placeholder="optional ISO date" /></div>
            <div><label>Effective to</label><input id="effectiveTo" placeholder="optional ISO date" /></div>
            <div><label>Evidence level</label><input id="evidenceLevel" value="reviewed_submission" /></div>
            <div><label>Confidence</label><select id="confidence"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select></div>
          </div>
          <label>Approved sanitized media URL</label><input id="sanitizedMediaUrl" placeholder="Optional separately sanitized public media URL" />
          <label>Reviewer notes</label><textarea id="reviewNotes"></textarea>
          <div class="actions" style="margin-top:12px">
            <button class="blue" onclick="sanitizeCandidate()">Save Sanitized Preview</button>
            <button class="primary" onclick="approveCandidate()">Approve & Publish</button>
            <button class="danger" onclick="rejectCandidate()">Reject</button>
            <button class="gold" onclick="requestCorrection()">Request Correction</button>
          </div>
        </section>
        <section>
          <h2>Duplicate, Merge, Retire, Supersede</h2>
          <div class="grid">
            <div><label>Target shared record</label><select id="targetSharedRecord"></select></div>
            <div><label>Retire/supersede record</label><select id="retireSharedRecord"></select></div>
            <div><label>Action reason</label><input id="actionReason" /></div>
            <div><label>Replacement record</label><select id="replacementSharedRecord"></select></div>
          </div>
          <div class="actions" style="margin-top:12px">
            <button class="gold" onclick="markDuplicate()">Mark Duplicate</button>
            <button class="green" onclick="mergeCandidate()">Merge/Link Evidence</button>
            <button class="danger" onclick="retireRecord()">Retire Shared Record</button>
            <button class="danger" onclick="supersedeRecord()">Supersede Shared Record</button>
          </div>
        </section>
      </div>
      <div>
        <section>
          <h2>Map Preview</h2>
          <div class="map-preview">
            <div class="coord-card"><strong>Private source coordinates</strong><div id="sourceCoords" class="meta"></div></div>
            <div class="coord-card"><strong>Sanitized shared coordinates</strong><div id="sharedCoords" class="meta"></div></div>
          </div>
        </section>
        <section class="audit">
          <h2>Audit Trail</h2>
          <div id="auditTrail"></div>
        </section>
      </div>
    </div>
  </main>
  <script>
    const csrfToken = ${JSON.stringify(csrfToken)};
    let currentCandidateId = document.body.dataset.candidateId || '';
    let currentDetail = null;
    let sharedRecords = [];
    const blockedPatterns = [/driver/i,/route/i,/manifest/i,/customer/i,/account/i,/invoice/i,/receipt/i,/delivery/i,/kpi/i,/employee/i,/private/i,/hazard-reports/i,/delivery-notes/i,/manual-hazards/i];
    function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    function msg(text) { document.getElementById('message').textContent = text || ''; }
    function value(id) { return document.getElementById(id).value.trim(); }
    function requireClean(value, label) {
      if (!String(value || '').trim()) throw new Error(label + ' is required.');
      const match = blockedPatterns.find((pattern) => pattern.test(String(value || '')));
      if (match) throw new Error(label + ' appears to contain private operational text.');
      return String(value).trim();
    }
    async function requestJson(url, options = {}) {
      const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', 'x-tsr-admin-csrf': csrfToken, ...(options.headers || {}) } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Request failed');
      return data;
    }
    function candidateLink(id) { return '/api/shared-safety/admin/candidates/' + encodeURIComponent(id); }
    async function loadQueue() {
      const params = new URLSearchParams();
      if (value('filterStatus')) params.set('status', value('filterStatus'));
      if (value('filterType')) params.set('hazardType', value('filterType'));
      if (value('filterSeverity')) params.set('severity', value('filterSeverity'));
      if (value('filterSourceOrg')) params.set('sourceOrganizationId', value('filterSourceOrg'));
      if (value('filterSubmittedFrom')) params.set('submittedFrom', value('filterSubmittedFrom'));
      if (value('filterSubmittedTo')) params.set('submittedTo', value('filterSubmittedTo'));
      params.set('sort', value('filterSort'));
      params.set('limit', value('filterLimit'));
      const data = await requestJson('/api/shared-safety/moderation/candidates?' + params.toString(), { method: 'GET' });
      document.getElementById('queueRows').innerHTML = (data.candidates || []).map((c) => {
        const sanitized = c.sanitizationStatus === 'sanitized' ? '<span class="pill ok">Complete</span>' : '<span class="pill warn">Needed</span>';
        const linkage = [c.publishedSharedRecordId ? 'Published: ' + c.publishedSharedRecordId : '', c.duplicateOfSharedRecordId ? 'Duplicate: ' + c.duplicateOfSharedRecordId : '', c.mergedIntoSharedRecordId ? 'Merged: ' + c.mergedIntoSharedRecordId : ''].filter(Boolean).map(escapeHtml).join('<br>') || '<span class="meta">None</span>';
        return '<tr><td><span class="pill">' + escapeHtml(c.reviewStatus) + '</span></td><td>' + escapeHtml(c.proposedSharedType) + '</td><td>' + escapeHtml(c.sourceOrganizationId || '') + '</td><td>' + sanitized + '</td><td>' + escapeHtml(c.submittedForReviewAt || '') + '</td><td>' + linkage + '</td><td><a class="tab" href="' + candidateLink(c.id) + '">Open</a></td></tr>';
      }).join('') || '<tr><td colspan="7">No moderation candidates found.</td></tr>';
    }
    async function loadSharedRecords() {
      const data = await requestJson('/api/shared-safety/records?limit=250', { method: 'GET' });
      sharedRecords = data.records || [];
      const options = '<option value="">Select shared record</option>' + sharedRecords.map((r) => '<option value="' + escapeHtml(r.id) + '">' + escapeHtml(r.hazardType + ' · ' + r.id) + '</option>').join('');
      ['targetSharedRecord','retireSharedRecord','replacementSharedRecord'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = options;
      });
    }
    async function loadDetail(id) {
      currentCandidateId = id;
      const data = await requestJson('/api/shared-safety/moderation/candidates/' + encodeURIComponent(id), { method: 'GET' });
      currentDetail = data;
      document.getElementById('detailPanel').classList.remove('hidden');
      document.getElementById('queuePanel').classList.remove('hidden');
      renderDetail(data);
      await loadSharedRecords();
    }
    function renderDetail(data) {
      const c = data.candidate || {};
      const s = data.sourceSubmission || {};
      document.getElementById('privateSource').innerHTML =
        '<div class="split"><div><h3>PRIVATE SOURCE</h3><p class="meta">Visible only to Platform Admin moderation.</p><p><strong>Organization:</strong> ' + escapeHtml(s.organizationName || s.organizationId || '') + '</p><p><strong>Submitted by:</strong> ' + escapeHtml(s.submittedByUserId || s.companyDriverNumber || s.internalDriverId || 'unknown') + '</p><p><strong>Status:</strong> ' + escapeHtml(s.status || '') + '</p><p><strong>Submitted:</strong> ' + escapeHtml(s.submittedAt || '') + '</p></div><div><h3>Evidence Summary</h3><p><strong>Type:</strong> ' + escapeHtml(s.hazardType || '') + '</p><p><strong>Coordinates:</strong> ' + escapeHtml((s.latitude ?? '') + ', ' + (s.longitude ?? '')) + '</p><p><strong>Description:</strong></p><pre>' + escapeHtml(s.description || '') + '</pre><p><strong>Private context:</strong></p><pre>' + escapeHtml(JSON.stringify(s.privateContext || {}, null, 2)) + '</pre></div></div>';
      document.getElementById('sharedType').value = c.proposedSharedType || s.hazardType || 'truck_restriction';
      document.getElementById('sanitizedDescription').value = c.sanitizedDescription || '';
      document.getElementById('sanitizedLatitude').value = c.sanitizedLatitude ?? s.latitude ?? '';
      document.getElementById('sanitizedLongitude').value = c.sanitizedLongitude ?? s.longitude ?? '';
      document.getElementById('reviewNotes').value = c.reviewNotes || '';
      document.getElementById('sourceCoords').textContent = (s.latitude ?? '') + ', ' + (s.longitude ?? '');
      document.getElementById('sharedCoords').textContent = (c.sanitizedLatitude ?? '') + ', ' + (c.sanitizedLongitude ?? '');
      document.getElementById('auditTrail').innerHTML = (data.auditEvents || []).map((event) => '<div class="coord-card"><strong>' + escapeHtml(event.eventType || '') + '</strong><div class="meta">' + escapeHtml(event.actorType + ' · ' + event.actorId + ' · ' + event.outcome + ' · ' + event.occurredAt) + '</div><div class="meta">Request: ' + escapeHtml(event.requestId || '') + '</div></div>').join('') || '<p class="meta">No audit events recorded for this candidate yet.</p>';
    }
    async function sanitizeCandidate() {
      try {
        const payload = { proposedSharedType: value('sharedType'), sanitizedDescription: requireClean(value('sanitizedDescription'), 'Sanitized description'), latitude: Number(value('sanitizedLatitude')), longitude: Number(value('sanitizedLongitude')), reviewNotes: value('reviewNotes'), sanitizedGeometry: { type: 'Point', coordinates: [Number(value('sanitizedLongitude')), Number(value('sanitizedLatitude'))] } };
        await requestJson('/api/shared-safety/moderation/candidates/' + encodeURIComponent(currentCandidateId) + '/sanitize', { method: 'PUT', body: JSON.stringify(payload) });
        msg('Sanitized preview saved.');
        await loadDetail(currentCandidateId);
      } catch (error) { msg(error.message); }
    }
    function approvalPayload() {
      const mediaUrl = value('sanitizedMediaUrl');
      if (mediaUrl) requireClean(mediaUrl, 'Sanitized media URL');
      return { severity: value('severity'), effectiveFrom: value('effectiveFrom') || null, effectiveTo: value('effectiveTo') || null, evidenceLevel: requireClean(value('evidenceLevel'), 'Evidence level'), confidence: value('confidence'), reviewNotes: value('reviewNotes'), sanitizedMedia: mediaUrl ? [{ url: mediaUrl, type: 'photo', caption: 'Approved sanitized Shared Safety media' }] : [] };
    }
    async function approveCandidate() {
      try { await requestJson('/api/shared-safety/moderation/candidates/' + encodeURIComponent(currentCandidateId) + '/approve', { method: 'POST', body: JSON.stringify(approvalPayload()) }); msg('Candidate approved and published.'); await loadDetail(currentCandidateId); await loadQueue(); await loadSharedRecords(); } catch (error) { msg(error.message); }
    }
    async function rejectCandidate() {
      const reason = window.prompt('Rejection reason');
      if (!reason) return;
      try { await requestJson('/api/shared-safety/moderation/candidates/' + encodeURIComponent(currentCandidateId) + '/reject', { method: 'POST', body: JSON.stringify({ reason, reviewNotes: value('reviewNotes') }) }); msg('Candidate rejected.'); await loadDetail(currentCandidateId); await loadQueue(); } catch (error) { msg(error.message); }
    }
    async function requestCorrection() {
      const note = window.prompt('Correction note', value('reviewNotes'));
      if (!note) return;
      try { await requestJson('/api/shared-safety/moderation/candidates/' + encodeURIComponent(currentCandidateId) + '/correction', { method: 'POST', body: JSON.stringify({ reviewNotes: note }) }); msg('Correction requested.'); await loadDetail(currentCandidateId); await loadQueue(); } catch (error) { msg(error.message); }
    }
    async function markDuplicate() {
      const target = value('targetSharedRecord');
      if (!target) return msg('Select target shared record.');
      try { await requestJson('/api/shared-safety/moderation/candidates/' + encodeURIComponent(currentCandidateId) + '/duplicate', { method: 'POST', body: JSON.stringify({ sharedRecordId: target, reviewNotes: value('actionReason') }) }); msg('Candidate marked duplicate.'); await loadDetail(currentCandidateId); await loadQueue(); } catch (error) { msg(error.message); }
    }
    async function mergeCandidate() {
      const target = value('targetSharedRecord');
      if (!target) return msg('Select target shared record.');
      try { await requestJson('/api/shared-safety/moderation/candidates/' + encodeURIComponent(currentCandidateId) + '/merge', { method: 'POST', body: JSON.stringify({ sharedRecordId: target, reviewNotes: value('actionReason') }) }); msg('Evidence linked to existing shared record.'); await loadDetail(currentCandidateId); await loadQueue(); } catch (error) { msg(error.message); }
    }
    async function retireRecord() {
      const target = value('retireSharedRecord');
      if (!target) return msg('Select shared record to retire.');
      try { await requestJson('/api/shared-safety/records/' + encodeURIComponent(target) + '/retire', { method: 'PUT', body: JSON.stringify({ reason: value('actionReason') || 'Retired through moderation UI.' }) }); msg('Shared record retired.'); await loadSharedRecords(); } catch (error) { msg(error.message); }
    }
    async function supersedeRecord() {
      const target = value('retireSharedRecord');
      const replacement = value('replacementSharedRecord');
      if (!target || !replacement) return msg('Select record and replacement.');
      try { await requestJson('/api/shared-safety/records/' + encodeURIComponent(target) + '/supersede', { method: 'PUT', body: JSON.stringify({ replacementSharedRecordId: replacement, reason: value('actionReason') || 'Superseded through moderation UI.' }) }); msg('Shared record superseded.'); await loadSharedRecords(); } catch (error) { msg(error.message); }
    }
    loadQueue().catch((error) => msg(error.message));
    loadSharedRecords().catch(() => {});
    if (currentCandidateId) loadDetail(currentCandidateId).catch((error) => msg(error.message));
  </script>
</body>
</html>`;
}

router.use(hydrateDriverContextIfPresented);

router.get('/admin', requirePlatformAdminPage, (req, res) => {
  res.type('html').send(renderModerationShell(req.adminSession, 'queue'));
});

router.get('/admin/candidates/:id', requirePlatformAdminPage, (req, res) => {
  res.type('html').send(renderModerationShell(req.adminSession, 'detail', req.params.id));
});

router.post(
  '/submissions',
  authorization.requirePermission(rbac.PERMISSIONS.HAZARD_SUBMIT),
  authorization.requireOrganizationContext,
  async (req, res) => {
    try {
      const result = await sharedSafety.createPrivateHazardSubmission(req.body || {}, req.authContext);
      audit(req, 'hazard_submission', 201);
      if (result.candidate) audit(req, 'nomination_for_moderation', 201);
      return res.status(201).json({
        submission: result.submission,
        moderationCandidate: result.candidate,
        message: 'Hazard submission saved as Organization-private. It is not platform-global unless sanitized and approved.'
      });
    } catch (error) {
      return sendError(req, res, error, 'Unable to create private hazard submission.');
    }
  }
);

router.get(
  '/submissions',
  authorization.requirePermission(rbac.PERMISSIONS.HAZARD_VIEW_ORGANIZATION),
  authorization.requireOrganizationContext,
  async (req, res) => {
    try {
      const submissions = await sharedSafety.listPrivateSubmissions(req.authContext, req.query || {});
      return res.json({ count: submissions.length, submissions });
    } catch (error) {
      return sendError(req, res, error, 'Unable to list private hazard submissions.');
    }
  }
);

router.post(
  '/submissions/:id/nominate',
  authorization.requirePermission(rbac.PERMISSIONS.HAZARD_REVIEW_ORGANIZATION),
  authorization.requireOrganizationContext,
  async (req, res) => {
    try {
      const candidate = await sharedSafety.nominateSubmission(req.params.id, req.authContext, req.body || {});
      audit(req, 'nomination_for_moderation', 201);
      return res.status(201).json({ candidate });
    } catch (error) {
      if (error.code === 'PRIVATE_SUBMISSION_NOT_FOUND') audit(req, 'cross_tenant_access_denial', 403, { code: error.code });
      return sendError(req, res, error, 'Unable to nominate private hazard submission.');
    }
  }
);

router.get(
  '/moderation/candidates',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_REVIEW),
  async (req, res) => {
    try {
      const candidates = await sharedSafety.listModerationCandidates(req.authContext, req.query || {});
      audit(req, 'moderation_opened', 200);
      return res.json({ count: candidates.length, candidates });
    } catch (error) {
      return sendError(req, res, error, 'Unable to list moderation candidates.');
    }
  }
);

router.get(
  '/moderation/candidates/:id',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_REVIEW),
  async (req, res) => {
    try {
      const detail = await sharedSafety.getModerationCandidateDetail(req.params.id, req.authContext);
      audit(req, 'moderation_opened', 200, { metadata: { candidateId: req.params.id } });
      return res.json(detail);
    } catch (error) {
      return sendError(req, res, error, 'Unable to load moderation candidate.');
    }
  }
);

router.put(
  '/moderation/candidates/:id/sanitize',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_REVIEW),
  requireCsrf,
  async (req, res) => {
    try {
      const candidate = await sharedSafety.sanitizeCandidate(req.params.id, req.authContext, req.body || {});
      audit(req, 'sanitization_completed', 200, { metadata: { candidateId: req.params.id } });
      return res.json({ candidate });
    } catch (error) {
      return sendError(req, res, error, 'Unable to sanitize moderation candidate.');
    }
  }
);

router.post(
  '/moderation/candidates/:id/correction',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_REVIEW),
  requireCsrf,
  async (req, res) => {
    try {
      const candidate = await sharedSafety.requestCandidateCorrection(req.params.id, req.authContext, req.body || {});
      audit(req, 'shared_safety_correction_requested', 200, { metadata: { candidateId: req.params.id } });
      return res.json({ candidate });
    } catch (error) {
      return sendError(req, res, error, 'Unable to request correction.');
    }
  }
);

router.post(
  '/moderation/candidates/:id/approve',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_APPROVE),
  authorization.requirePermission(rbac.PERMISSIONS.SHARED_SAFETY_PUBLISH),
  requireCsrf,
  async (req, res) => {
    try {
      const record = await sharedSafety.approveCandidate(req.params.id, req.authContext, req.body || {});
      audit(req, 'shared_safety_approval', 201, { metadata: { candidateId: req.params.id, sharedRecordId: record.id } });
      audit(req, 'shared_safety_publish', 201, { metadata: { candidateId: req.params.id, sharedRecordId: record.id } });
      return res.status(201).json({ sharedSafetyRecord: record });
    } catch (error) {
      return sendError(req, res, error, 'Unable to approve moderation candidate.');
    }
  }
);

router.post(
  '/moderation/candidates/:id/reject',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_REJECT),
  requireCsrf,
  async (req, res) => {
    try {
      const candidate = await sharedSafety.rejectCandidate(req.params.id, req.authContext, req.body || {});
      audit(req, 'shared_safety_rejection', 200, { metadata: { candidateId: req.params.id } });
      return res.json({ candidate });
    } catch (error) {
      return sendError(req, res, error, 'Unable to reject moderation candidate.');
    }
  }
);

router.post(
  '/moderation/candidates/:id/duplicate',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_REVIEW),
  requireCsrf,
  async (req, res) => {
    try {
      const candidate = await sharedSafety.markDuplicate(req.params.id, req.authContext, req.body || {});
      audit(req, 'shared_safety_duplicate_decision', 200, { metadata: { candidateId: req.params.id, sharedRecordId: candidate.duplicateOfSharedRecordId } });
      return res.json({ candidate });
    } catch (error) {
      return sendError(req, res, error, 'Unable to mark moderation candidate as duplicate.');
    }
  }
);

router.post(
  '/moderation/candidates/:id/merge',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_REVIEW),
  requireCsrf,
  async (req, res) => {
    try {
      const candidate = await sharedSafety.mergeCandidateIntoSharedRecord(req.params.id, req.authContext, req.body || {});
      audit(req, 'shared_safety_merge_link_completed', 200, { metadata: { candidateId: req.params.id, sharedRecordId: candidate.mergedIntoSharedRecordId } });
      return res.json({ candidate });
    } catch (error) {
      return sendError(req, res, error, 'Unable to merge/link moderation candidate.');
    }
  }
);

router.put(
  '/records/:id/retire',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_RETIRE),
  requireCsrf,
  async (req, res) => {
    try {
      const record = await sharedSafety.retireSharedRecord(req.params.id, req.authContext, req.body || {});
      audit(req, 'shared_safety_retire', 200, { metadata: { sharedRecordId: req.params.id } });
      return res.json({ sharedSafetyRecord: record });
    } catch (error) {
      return sendError(req, res, error, 'Unable to retire shared safety record.');
    }
  }
);

router.put(
  '/records/:id/supersede',
  ...requirePlatformPermission(rbac.PERMISSIONS.SHARED_SAFETY_RETIRE),
  requireCsrf,
  async (req, res) => {
    try {
      const record = await sharedSafety.supersedeSharedRecord(req.params.id, req.authContext, req.body || {});
      audit(req, 'shared_safety_superseded', 200, { metadata: { sharedRecordId: req.params.id, supersededBy: record.supersededBy } });
      return res.json({ sharedSafetyRecord: record });
    } catch (error) {
      return sendError(req, res, error, 'Unable to supersede shared safety record.');
    }
  }
);

router.get('/records', authorization.requireAuthentication, async (req, res) => {
  try {
    const records = await sharedSafety.listSharedRecords(req.query || {});
    return res.json({ count: records.length, records });
  } catch (error) {
    return sendError(req, res, error, 'Unable to list shared safety records.');
  }
});

module.exports = router;
