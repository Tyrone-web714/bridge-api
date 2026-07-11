# Warehouse Authentication

Protected warehouse inventory workflows now require:

- company employee ID / employee ID
- PIN

The admin route-manifest page supports creating or resetting warehouse employee PINs.

Warehouse employees receive:

- Organization context
- approved WAREHOUSE_EMPLOYEE role
- `warehouse.confirm` permission

Employee ID alone is no longer sufficient for protected warehouse record-changing inventory work.
