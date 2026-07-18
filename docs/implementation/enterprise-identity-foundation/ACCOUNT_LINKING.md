# Account Linking

Account linking is controlled and explicit.

Implemented safeguards:

- No automatic linking by email alone.
- Cross-tenant linking is rejected.
- Provider subject uniqueness is enforced.
- Internal TSR user UUID is preserved.
- External subject is stored as the permanent provider identity key.

Future workflows must handle email changes, IdP migration, duplicate accounts, multiple external identities, and employee transfers.

