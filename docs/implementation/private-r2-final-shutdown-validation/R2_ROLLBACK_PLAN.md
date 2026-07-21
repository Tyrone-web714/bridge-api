# R2 Rollback Plan

## Rollback Trigger

Rollback is required if disabling public R2 access causes authorized media retrieval, mobile media display, admin media display, or operational readiness checks to fail.

## Rollback Action

Re-enable the same Cloudflare R2 public access setting that was disabled during the shutdown window. Do not restore, delete, copy, or rewrite objects unless a separate data-recovery incident is declared.

## Rollback Validation

After re-enabling public access:

1. Confirm `/health` is 200.
2. Confirm `/ready` is 200.
3. Confirm authorized `/api/media` access succeeds.
4. Confirm mobile delivery-note media renders.
5. Confirm admin delivery-note media renders.
6. Confirm no production database records were modified by rollback.
7. Record timestamps, symptoms, root cause, and follow-up fix.

## Rollback Readiness

Rollback is operationally straightforward because the planned shutdown action is a Cloudflare access-setting change, not an object mutation. Rollback still requires owner/operator access to the Cloudflare R2 bucket settings.
