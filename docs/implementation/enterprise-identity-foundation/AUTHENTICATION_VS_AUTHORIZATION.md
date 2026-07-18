# Authentication Versus Authorization

External IdPs authenticate identities.

TSR authorizes access.

After federation, the service rebuilds TSR context from server-side records:

- Organization
- Internal user
- Organization membership
- Approved TSR role
- Explicit permissions
- Lifecycle status

External claims are not final authorization authority.

