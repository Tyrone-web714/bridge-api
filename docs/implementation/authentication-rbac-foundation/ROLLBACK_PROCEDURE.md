# Rollback Procedure

Rollback strategy:

1. Revert the authentication/RBAC code commit on the branch.
2. Redeploy the previous validated backend commit.
3. Keep additive database columns/tables in place unless a formal rollback window is approved.
4. If a non-production database rollback is required, drop only phase-owned objects after confirming no dependent data is needed:
   - `warehouse_employee_sessions`
   - `role_permissions`
   - phase-added nullable columns
5. Re-enable previous warehouse workflow only in non-production testing if needed to diagnose compatibility.

Do not remove production audit or auth metadata without a separate approved data-retention decision.
