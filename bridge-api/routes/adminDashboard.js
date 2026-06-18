const express = require('express');
const adminAuth = require('../services/adminAuth');

const router = express.Router();

function requireAdminDashboard(req, res, next) {
  const session = adminAuth.getAdminSession(req);
  if (!session) return res.redirect('/api/routing/manual-hazards/admin/login');
  req.adminSession = session;
  return next();
}

function renderAdminDashboard(session) {
  const username = session?.username || 'supervisor';
  const role = session?.role || 'supervisor';
  const sessionRole = String(username).toLowerCase() === String(role).toLowerCase()
    ? ''
    : role;
  const cards = [
    {
      title: 'Production Data Imports',
      description: 'Preview and import customer masters, product catalogs, invoices, and sales-line history into PostgreSQL.',
      href: '/api/data-imports/admin',
      accent: '#65e69a'
    },
    {
      title: 'Daily Routes',
      description: 'Upload full route CSVs, bulk assign drivers, review totals, delete test routes, and manage daily route manifests.',
      href: '/api/route-manifests/admin',
      accent: '#19d3e6'
    },
    {
      title: 'Driver Registry',
      description: 'Maintain driver IDs, names, employee numbers, route teams, active status, and supervisor notes for route assignments.',
      href: '/api/drivers/admin',
      accent: '#7dffb0'
    },
    {
      title: 'Hazard Review',
      description: 'Review driver-submitted hazards and manually manage low bridges, no-truck restrictions, and residential restrictions.',
      href: '/api/routing/manual-hazards/admin',
      accent: '#ff5964'
    },
    {
      title: 'Static Hazard Verification',
      description: 'Verify imported low bridge and restricted-road records on a map before they become trusted production hazards.',
      href: '/api/routing/hazard-verification/admin',
      accent: '#ffbf3f'
    },
    {
      title: 'Delivery Notes',
      description: 'Review account notes and driver-uploaded photos tied to individual customer locations.',
      href: '/api/delivery-notes/admin',
      accent: '#7dffb0'
    },
    {
      title: 'Account Intelligence',
      description: 'Track SKU-level purchases, deductions, account spending, and AI-ready account insights.',
      href: '/api/account-intelligence/admin',
      accent: '#ffbf3f'
    },
    {
      title: 'Supervisor Intelligence Queue',
      description: 'Prioritize, inspect, approve, reject, and document AI-generated operational recommendations before action.',
      href: '/api/account-intelligence/insights/admin',
      accent: '#c084fc'
    },
    {
      title: 'Supervisor Alerts and Reports',
      description: 'Review operational alerts, acknowledge or resolve exceptions, and inspect scheduled daily intelligence briefs.',
      href: '/api/supervisor-intelligence/admin',
      accent: '#ff5964'
    },
    {
      title: 'Operational Heatmaps',
      description: 'Map recurring delivery delays, failed stops, deductions, hazard events, route events, and recorded revenue concentration.',
      href: '/api/operational-heatmaps/admin',
      accent: '#ff7a18'
    },
    {
      title: 'Operational Geography',
      description: 'Define distribution centers, territories, route groups, and the hierarchy used by heatmaps and route operations.',
      href: '/api/operational-geography/admin',
      accent: '#48cae4'
    },
    {
      title: 'AI Operations Status',
      description: 'Inspect AI provider configuration, request reliability, latency, token usage, and recent failures.',
      href: '/api/account-intelligence/admin',
      accent: '#a78bfa'
    },
    {
      title: 'Route Replay',
      description: 'Inspect route sessions, warning events, safety analytics, and driver behavior after completed trips.',
      href: '/api/routing/route-sessions/admin',
      accent: '#8cb4ff'
    },
    {
      title: 'Admin Users',
      description: 'Create supervisor/admin users, update passwords, deactivate accounts, and control access.',
      href: '/api/routing/manual-hazards/admin-users/admin',
      accent: '#c89cff',
      adminOnly: true
    }
  ];
  const visibleCards = cards.filter((card) => !card.adminOnly || role === 'admin');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Truck-Safe Supervisor Dashboard</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #061019;
      --panel: rgba(255,255,255,0.08);
      --panel-strong: rgba(255,255,255,0.12);
      --line: rgba(255,255,255,0.16);
      --text: #f3fbff;
      --muted: #a9bdc7;
      --red: #d9212e;
      --cyan: #19d3e6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Arial, sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at 16% 10%, rgba(217,33,46,0.22), transparent 30%),
        radial-gradient(circle at 86% 8%, rgba(25,211,230,0.20), transparent 28%),
        linear-gradient(160deg, #061019 0%, #0a1f2d 56%, #13080b 100%);
    }
    header {
      padding: 34px clamp(20px, 4vw, 52px) 22px;
      border-bottom: 1px solid var(--line);
      background: rgba(3,10,16,0.42);
      backdrop-filter: blur(12px);
    }
    .topline {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
      font-size: clamp(30px, 4vw, 52px);
      letter-spacing: 0;
      line-height: 1.03;
    }
    .subtitle {
      max-width: 760px;
      margin: 14px 0 0;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.45;
    }
    .session {
      min-width: 220px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--panel);
    }
    .session strong { display: block; font-size: 14px; }
    .session span { display: block; margin-top: 4px; color: var(--muted); font-size: 12px; text-transform: uppercase; font-weight: 800; }
    main {
      padding: 26px clamp(20px, 4vw, 52px) 54px;
    }
    .quickbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 22px;
    }
    a, button {
      font: inherit;
    }
    .pill, .logout {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 9px 14px;
      color: var(--text);
      background: rgba(255,255,255,0.08);
      font-weight: 900;
      text-decoration: none;
      cursor: pointer;
    }
    .logout {
      border-color: rgba(255,255,255,0.22);
      background: rgba(217,33,46,0.82);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 18px;
    }
    .card {
      position: relative;
      display: flex;
      min-height: 220px;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      border: 1px solid var(--line);
      border-radius: 22px;
      padding: 20px;
      background: linear-gradient(180deg, var(--panel-strong), rgba(255,255,255,0.055));
      color: var(--text);
      text-decoration: none;
      box-shadow: 0 18px 40px rgba(0,0,0,0.24);
    }
    .card::before {
      content: "";
      position: absolute;
      inset: 0 auto 0 0;
      width: 7px;
      background: var(--accent);
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: rgba(255,255,255,0.32);
    }
    .card h2 {
      margin: 0;
      font-size: 24px;
      line-height: 1.1;
    }
    .card p {
      margin: 12px 0 24px;
      color: var(--muted);
      line-height: 1.45;
    }
    .open {
      align-self: flex-start;
      border-radius: 999px;
      padding: 10px 14px;
      color: #041016;
      background: var(--accent);
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .status {
      margin-top: 22px;
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 14px 16px;
      background: rgba(0,0,0,0.18);
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <header>
    <div class="topline">
      <div>
        <h1>Supervisor Dashboard</h1>
        <p class="subtitle">One desktop entry point for daily route assignment, safety hazard review, delivery intelligence, route replay, and admin access.</p>
      </div>
      <div class="session">
        <strong>${username}</strong>
        ${sessionRole ? `<span>${sessionRole}</span>` : ''}
      </div>
    </div>
  </header>
  <main>
    <div class="quickbar">
      <form method="post" action="/api/routing/manual-hazards/admin/logout">
        <button class="logout" type="submit">Log Out</button>
      </form>
    </div>
    <section class="grid">
      ${visibleCards.map((card) => `
        <a class="card" href="${card.href}" style="--accent:${card.accent}">
          <div>
            <h2>${card.title}</h2>
            <p>${card.description}</p>
          </div>
          <span class="open">Open</span>
        </a>
      `).join('')}
    </section>
    <div class="status">
      Production URL: <strong>/api/admin</strong>. Existing direct admin URLs still work, but supervisors should start here.
    </div>
  </main>
</body>
</html>`;
}

router.get('/', requireAdminDashboard, (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  return res.send(renderAdminDashboard(req.adminSession));
});

module.exports = router;
