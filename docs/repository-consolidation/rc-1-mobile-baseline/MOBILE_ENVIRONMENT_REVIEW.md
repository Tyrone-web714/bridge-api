# Mobile Environment Review

## Environment Files

- `.env` is local-only, untracked, and must remain excluded from Git.
- `.env.example` is proposed for inclusion as a placeholder template.
- Expo public variables are bundled into the mobile client and must never contain server-only secrets.

## Backend URL

Preview and production mobile configuration should point at the Render backend URL:

- `https://truck-safe-routing-api.onrender.com`

Development can use a local or LAN backend URL when testing on a device.

## Google Maps Configuration

The Android Maps key is client-side configuration. It is not a server secret, but it must be restricted in Google Cloud Console by Android package and signing certificate.

Known package:

- `com.nasih.trucksaferouting`

## EAS / Expo Metadata

Known EAS project metadata:

- Expo slug: `truck-safe-routing`
- EAS project ID: `4b7843f4-3d14-4c64-8223-39b06601c781`

These identifiers are project metadata, not secret credentials.

## Production Security Note

Any shared driver API token or client-exposed operational token must be retired or replaced before production use. RC-1 does not implement authentication changes; it only ensures local secret values are not committed.
