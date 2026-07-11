# Web/Supervisor/Admin UI Audit

## Current Implementation

Server-rendered pages are embedded in Express route files. Verified page areas include dashboard, route manifests, hazard review, static hazard verification, delivery notes, driver registry/team rosters, supervisor accounts, operational heatmaps, operational geography, account intelligence, supervisor intelligence, alerts/reports, AI operations, and route replay.

## Findings

- High: pages and backing APIs require Organization filters before multi-tenant use.
- Medium: UI rendering, API handlers, and business logic are tightly coupled in route files.
- Medium: pagination/export consistency requires endpoint-level review.
- Medium: admin role boundaries are partial; target Volume II role model is broader.
- Low: accessibility is not systematically verified.

## Recommendation

Do not redesign the UI before tenant safety. First create tenant-aware APIs and permission checks; then split server-rendered pages where risk justifies it.
