# Private Submission Model

`private_hazard_submissions` stores source records submitted by drivers or authorized Organization users.

Required governance:

- `organization_id` is trusted from the authenticated session.
- Client-supplied Organization ownership is not accepted as authority.
- Route, stop, customer, and workflow context belongs only in `private_context`.
- Private photo metadata remains private.

Statuses:

- `submitted`
- `submitted_for_platform_review`
- `correction_requested`
- `shared_approved`
- `shared_rejected`
- `archived`

