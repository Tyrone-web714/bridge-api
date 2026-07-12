# UI Route Map

HTML routes:

- `GET /api/shared-safety/admin`
- `GET /api/shared-safety/admin/candidates/:id`

JSON detail/action routes:

- `GET /api/shared-safety/moderation/candidates`
- `GET /api/shared-safety/moderation/candidates/:id`
- `PUT /api/shared-safety/moderation/candidates/:id/sanitize`
- `POST /api/shared-safety/moderation/candidates/:id/approve`
- `POST /api/shared-safety/moderation/candidates/:id/reject`
- `POST /api/shared-safety/moderation/candidates/:id/correction`
- `POST /api/shared-safety/moderation/candidates/:id/duplicate`
- `POST /api/shared-safety/moderation/candidates/:id/merge`
- `PUT /api/shared-safety/records/:id/retire`
- `PUT /api/shared-safety/records/:id/supersede`

The dashboard entry is visible only to Platform Admin sessions.

