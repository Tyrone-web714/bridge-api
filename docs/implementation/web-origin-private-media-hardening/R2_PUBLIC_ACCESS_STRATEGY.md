# R2 Public Access Strategy

## Current Position

The R2 public URL remains enabled for compatibility until production media metadata and client behavior are fully verified.

The verified production metadata assessment found 3 existing delivery-note media items with direct public `r2.dev` current URLs. Public R2 access cannot be disabled immediately.

## Why It Remains Enabled

Turning off public access immediately could break existing media links in delivery notes, hazard reports, supervisor views, or mobile workflows.

## Required Before Disabling

- Owner-approved read-only production media inventory.
- Migration or safe compatibility transition for the 3 existing production delivery-note media items.
- Migration plan for records containing public URLs.
- Client verification that authenticated media URLs are used.
- Rollback procedure for restoring access if a field workflow breaks.

## Target Direction

Organization-private media should be private by default and retrieved through authenticated application APIs.
