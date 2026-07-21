# Web and Admin Media Compatibility

## Result

Web/admin delivery-note media compatibility is source-verified for current primary URL usage, but a credentialed browser walkthrough remains required before actual public R2 shutdown.

## Delivery Notes Admin Path

The server-rendered delivery-note page uses the media object's primary `url` field for image rendering. Current production evidence reports:

- Direct public current URLs: 0.
- Authenticated access paths: 5.

Therefore the delivery-note admin page should render through authenticated TSR media paths for the current media records.

## Legacy Metadata

The web/admin delivery-note render path does not need `legacyPublicUrl` for current display. `legacyPublicUrl` is preserved as compatibility/audit metadata and is counted by the production assessment.

## Hazard and Shared Safety Media

Production evidence shows no current media records for `private_hazard_submissions` or `shared_safety_records`. Those paths must remain included in the shutdown checklist if media is added later.

## Remaining Operational Walkthrough

Before actual shutdown, perform a credentialed browser walkthrough:

1. Sign in to the admin dashboard.
2. Open Delivery Notes.
3. Verify migrated delivery-note media renders through `/api/media`.
4. Confirm expired or unauthenticated browser sessions cannot retrieve private media.
5. Confirm a user outside the Organization cannot retrieve private media.
6. Verify hazard and Shared Safety pages do not expose private media through public URLs.
