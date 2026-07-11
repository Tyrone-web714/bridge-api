# Truck-Safe Routing Architecture Index

**Version:** 1.0  
**Status:** Approved Architecture Index  
**Purpose:** This file is the master table of contents for the Truck-Safe Routing architecture library.

## Reading Order

1. CODEX_START_HERE.md
2. README.md
3. ARCHITECTURE_GOVERNANCE_BASELINE_v1.0.md
4. IMPLEMENTATION_ORDER.md
5. Volume I — Vision & Enterprise Architecture
6. Volume II — Multi-Tenant SaaS & Security
7. Volume III — Fleet Operations & Navigation
8. Volume IV — Business Intelligence, KPI & AI
9. Volume V — Platform API, Database & Deployment
10. Volume VI — Logistics Intelligence Engine
11. Volume VII — Fleet Intelligence Scoring System
12. Product Requirements Specification Part I — Platform Foundation (`../product/Product-Requirements-Specification-Part-I-Platform-Foundation.md`)

## Volume Summaries

### Architecture Governance Baseline v1.0
Declares the completed Phase 0 governance baseline for Organization tenancy, driver identity, roles, API privacy, shared safety, retention, environments, rollback baseline, object storage, and warehouse authentication. Future implementation work must conform to this baseline unless superseded by an approved Architecture Decision Record.

### Volume I — Vision & Enterprise Architecture
Defines the platform vision, product philosophy, architecture governance, engineering principles, AI governance, security philosophy, and long-term direction.

### Volume II — Multi-Tenant SaaS & Security
Defines Organization isolation, tenant boundaries, authentication, authorization, RBAC, claims, shared safety review, billing-ready SaaS structure, and enterprise security requirements.

### Volume III — Fleet Operations & Navigation
Defines drivers, vehicles, routes, stops, customers, supervisor workflows, dispatch, navigation, offline operations, and logistics field execution.

### Volume IV — Business Intelligence, KPI & AI
Defines configurable KPIs, dashboards, reports, formula engine, drill-down analytics, predictive intelligence, AI explainability, and executive reporting.

### Volume V — Platform API, Database & Deployment
Defines APIs, database architecture, migrations, integrations, testing, CI/CD, deployment, monitoring, disaster recovery, and operational readiness.

### Volume VI — Logistics Intelligence Engine
Defines the reasoning layer that turns operational events into insights, recommendations, predictions, human-approved actions, and outcome learning.

### Volume VII — Fleet Intelligence Scoring System
Defines composite intelligence scores for drivers, vehicles, routes, customers, depots, supervisors, Organizations, and fleets.

### Product Requirements Specification Part I — Platform Foundation
Authoritative path: [`../product/Product-Requirements-Specification-Part-I-Platform-Foundation.md`](../product/Product-Requirements-Specification-Part-I-Platform-Foundation.md).

Begins the product requirements layer, defining core modules, actors, assumptions, scope, product vision, functional requirements, non-functional requirements, and acceptance criteria.

## Codex Guidance

Codex must treat these documents as governing architecture. If implementation conflicts with architecture, Codex must report the conflict and recommend options rather than silently violating the specification.

No architectural change may be implemented unless it is reflected in the architecture documentation or an approved Architecture Decision Record (ADR). This gate applies to significant design changes, not small implementation fixes that leave the architecture unchanged.
