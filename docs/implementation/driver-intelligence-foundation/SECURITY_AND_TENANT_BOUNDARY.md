# Security And Tenant Boundary

Requests require trusted tenant context. Driver profile organization identity must be server-derived or otherwise trusted by the calling boundary.

The foundation rejects missing tenant context and rejects caller attempts to select provider, model, premium execution, employee score, or employee rank.

No authentication or authorization middleware is changed in this phase.
