# Codex Start Here

**Project:** Truck-Safe Routing  
**Version:** 1.0  
**Status:** Required Codex Entry Document

## What This Project Is

Truck-Safe Routing is an enterprise Logistics Intelligence Platform for commercial fleets. It is not merely a navigation app. It combines truck-safe routing, fleet operations, shared truck-safety intelligence, business intelligence, custom KPIs, AI decision support, and multi-tenant SaaS architecture.

## Read First

Before making any code changes, read:

1. ARCHITECTURE_INDEX.md
2. CODEX_INSTRUCTIONS.md, if present
3. IMPLEMENTATION_ORDER.md, if present
4. Volumes Iâ€“V
5. Volume VI â€” Logistics Intelligence Engine
6. Volume VII â€” Fleet Intelligence Scoring System
7. `../product/Product-Requirements-Specification-Part-I-Platform-Foundation.md`

## Required First Action

Do not code first.

First produce:

1. Current architecture audit
2. Repository audit
3. Database audit
4. API audit
5. Security audit
6. Tenant-isolation risk report
7. Migration plan
8. Rollback plan
9. Testing plan
10. Phased implementation roadmap

## Non-Negotiable Rules

- Never weaken tenant isolation.
- Never bypass authentication, authorization, RBAC, or audit logging.
- Never expose one Organization's private data to another Organization.
- Never hardcode one customer as permanent logic.
- Never make destructive database changes without rollback guidance.
- Never allow AI recommendations to modify operational data without approved workflow.

