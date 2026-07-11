# Truck-Safe Routing Architecture Knowledge Base

This folder contains the governing architecture documents for Truck-Safe Routing.

Codex and all developers must read this folder before making architectural changes.

## Required Reading Order

1. `CODEX_START_HERE.md`
2. `CODEX_INSTRUCTIONS.md`
3. `IMPLEMENTATION_ORDER.md`
4. `Volume-I-Vision-and-Enterprise-Architecture.md`
5. `Volume-II-Multi-Tenant-SaaS-and-Security.md`
6. `Volume-III-Fleet-Operations-and-Navigation.md`
7. `Volume-IV-Business-Intelligence-KPI-and-AI.md`
8. `Volume-V-Platform-API-Database-and-Deployment.md`
9. `Volume-VI-Logistics-Intelligence-Engine.md`
10. `Volume-VII-Fleet-Intelligence-Scoring-System.md`
11. [`Product Requirements Specification Part I`](../product/Product-Requirements-Specification-Part-I-Platform-Foundation.md)
12. `CODING_STANDARDS.md`
13. `GLOSSARY.md`

## Product Requirements

The authoritative Product Requirements Specification Part I is [`../product/Product-Requirements-Specification-Part-I-Platform-Foundation.md`](../product/Product-Requirements-Specification-Part-I-Platform-Foundation.md).

## Core Rule

Do not implement features before completing an audit, migration plan, rollback plan, and test plan.

## Architecture Change Rule

No architectural change may be implemented unless it is reflected in the architecture documentation or an approved Architecture Decision Record (ADR).

This rule applies to significant design changes, including adding a new service, changing the tenant model, changing authentication or authorization boundaries, changing database ownership boundaries, or introducing a new AI capability. It does not require documentation updates for small implementation fixes that do not alter the architecture.
