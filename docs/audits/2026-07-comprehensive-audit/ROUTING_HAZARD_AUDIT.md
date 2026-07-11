# Routing, Maps, and Hazard Engine Audit

## Current Assets

Safe-route endpoint, Google Maps integration, low-clearance bridge data, truck restricted zones, manual hazards, driver hazard reports, static hazard verification, PostGIS readiness checks, and mobile Google Maps UI exist.

## Findings

- High: shared safety architecture requires separation of Organization-private submissions from approved global hazards.
- High: Google Maps/Places/Directions terms, attribution, retention, caching, and key restrictions remain release gates.
- Medium: hazard freshness, source confidence, duplicate handling, and false negative/positive rates require field validation.
- Medium: hazard scoring and map rendering need scale tests.
- Low: Leaflet/OpenStreetMap in admin replay/heatmap pages still requires attribution and tile usage review.

## Requirements for Shared Safety Governance

Private submission table, Organization review state, platform review state, sanitized approved global table, source/confidence/version fields, and audit log for approve/reject/merge/archive actions.
