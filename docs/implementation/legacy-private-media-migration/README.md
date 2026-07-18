# Legacy Private Media Migration

## Purpose

Prepare a bounded, dry-run-first migration for the 3 verified legacy delivery-note media references that still use direct public R2 URLs as their current primary access path.

## Scope

- Dry-run migration tooling.
- Aggregate production candidate validation.
- Target-state documentation.
- Rollback and safety design.

## Out Of Scope

- Production writes.
- Media content retrieval.
- R2 object deletion or re-upload.
- Cloudflare R2 public-access shutdown.
- Deployment.

## Current Distinction

- New private media path: hardened.
- Legacy public media migration: pending.
- Public R2 shutdown: pending.
