# Compatibility Impact

Mobile compatibility:

- Driver login response shape was not changed.
- Assigned-route workflows were not changed.
- Places proxy endpoints now require the existing driver bearer token or admin session.
- Place photo and Street View proxy access now require authentication; clients must use authenticated API access.

Web/admin compatibility:

- Admin pages continue using the existing admin session cookie.
- Delivery-note photos continue loading for authenticated admin pages.

Warehouse compatibility:

- Warehouse workflows continue using employee ID plus PIN.
- The server now attaches Warehouse Employee auth context after verification.
