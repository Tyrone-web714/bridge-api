# Web Origin and Private Media Security Hardening

## Purpose

This phase hardens two production-pilot security boundaries without changing the core platform architecture:

- Browser web origins must be explicitly allowed for production CORS.
- Organization-private media must be addressed through authenticated backend access paths instead of assuming direct public object URLs are safe.

## Scope

- CORS policy helper and validation tests.
- Authenticated `/api/media/:mediaId` application-controlled media route.
- Delivery-note photo metadata compatibility for existing R2-backed records.
- Documentation for current exposure, migration, rollback, and remaining media security work.

## Out of Scope

- Disabling the existing Cloudflare R2 public development URL.
- Production media migration.
- Production object deletion or mutation.
- New frontend deployment.
- Enterprise Identity provider verification.

## Validation

Run from `C:\dev\bridge-api\bridge-api`:

```powershell
npm.cmd run test:web-origin
npm.cmd run test:private-media
npm.cmd test
npm.cmd run verify:secrets
git diff --check
```
