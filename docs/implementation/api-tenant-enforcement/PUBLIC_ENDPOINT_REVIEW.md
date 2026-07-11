# Public Endpoint Review

Approved public endpoints:

- `/health`
- `/ready`
- `/api/driver-auth/login`
- `/api/routing/manual-hazards/admin/login`

Changed from public to authenticated:

- `/api/places/autocomplete`
- `/api/places/details`
- `/api/places/street-view`
- `/api/places/street-view-embed`
- `/api/places/photo`
- `/api/places/recent-destinations`
- `/api/delivery-notes/photos/:filename`

Temporary public/reference endpoints for future review:

- bridge reference reads
- supervisor placeholder route
- platform-global hazard reference reads
