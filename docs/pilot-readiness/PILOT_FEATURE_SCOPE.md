# Pilot Feature Scope

Initial pilot scope:

- Authentication and role-scoped access.
- One Organization and one depot.
- Driver route assignment.
- Truck-safe route display.
- Hazard and restriction warnings.
- Stop completion.
- Offline stop queueing and reconnect replay after validation.
- Supervisor operational visibility.
- Audit logging and evidence capture.
- Notes/photos only after private media and mobile replay validation are included in the pilot packet.

Excluded from initial pilot:

- D1 predictive/statistical intelligence.
- Production D2 AI routing.
- Broad enterprise SSO rollout unless the pilot Organization requires it.
- Full warehouse operations unless required for route departure/return.
- Large-scale historical import.
- App store release.
- Premium AI models.
- Additional intelligence domains.

Shadow or internal-only:

- D2 selected-model evidence review.
- Non-production AI smoke evidence.
- Internal post-route analysis that does not affect driver, supervisor, customer, safety, or dispatch decisions.

Scope control:

Any feature added to the live pilot must have a named owner, risk classification, test evidence,
rollback plan, and explicit approval before it is exposed to pilot users.
