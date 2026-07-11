# Truck-Safe Routing

Truck-Safe Routing is currently consolidated in this repository for backend, mobile, and governing documentation work.

## Repository Layout

- `bridge-api/` - Node/Express backend, API, supervisor/admin dashboard, routing services, deployment configuration, and backend tests.
- `apps/mobile/` - Active React Native/Expo mobile application imported from the standalone mobile baseline.
- `docs/` - Governing architecture, product, audit, repository-consolidation, and operational documentation for the complete Truck-Safe Routing platform.

## Development Boundaries

Backend and mobile package installs remain independent during this consolidation phase. Do not introduce npm workspaces or move the backend into `apps/api` without a separately approved plan.

The standalone mobile repository remains preserved at:

`https://github.com/Tyrone-web714/truck-safe-routing-mobile`

The mobile baseline rollback tag is:

`mobile-baseline-v1.0`

## Architecture Governance

Codex and future implementation work must read `docs/architecture/CODEX_START_HERE.md` before architectural changes. Significant design changes must be reflected in the governing architecture documentation or an approved Architecture Decision Record.
