# Truck-Safe Routing Database Migration

The backend now supports PostgreSQL for production data while keeping local JSON fallback for development.

## Current Behavior

- If `DATABASE_URL` is set, the backend uses PostgreSQL for:
  - Manual hazards
  - Driver hazard reports
  - Delivery notes
- Recent destinations
- Route hazard candidate lookups
- Visible map hazard lookups
- Live proximity hazard lookups
- Static hazard location backfill queue
- Route session replay logs
- If `DATABASE_URL` is not set, the backend keeps using local JSON files.
- Uploaded delivery-note photos now use the photo storage adapter. Local development can still use `data/delivery_note_photos`, but production pilot must use `PHOTO_STORAGE_PROVIDER=s3`.

## PostgreSQL Environment Variables

Add these to `.env`:

```env
DATABASE_URL=postgres://username:password@localhost:5432/truck_safe_routing
DATABASE_SSL=false
```

For a hosted database that requires SSL:

```env
DATABASE_SSL=true
```

## Migrate JSON Data Into PostgreSQL

From the backend folder:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm run db:migrate:json
```

This imports:

- `data/manual_hazards.json`
- `data/delivery_notes.json`
- `data/recent_destinations.json`
- `data/low_clearance_bridges.json`
- `data/no_truck_zones.json`
- `data/residential_zones.json`

## Verify Backend Database Mode

Start the backend:

```powershell
npm start
```

Open:

```text
http://localhost:5000/health
```

Expected database values:

- `"database":"postgres"` means PostgreSQL is active.
- `"database":"json-fallback"` means `DATABASE_URL` is not set.

## Enable PostGIS Spatial Indexing

PostGIS is a PostgreSQL extension. It is not included in every PostgreSQL installation by default.

Check whether PostGIS is available:

```powershell
cd "C:\dev\bridge-api\bridge-api"
node -e "require('dotenv').config(); const pg=require('./db/postgres'); (async()=>{const r=await pg.rawQuery(\"SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name='postgis'\"); console.log(r.rows); await pg.closePool();})()"
```

If the result is an empty array, install PostGIS with **Stack Builder** for PostgreSQL 17.

After PostGIS is installed, run:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm run db:postgis:init
```

This command:

- Enables the `postgis` extension.
- Adds spatial geometry columns.
- Creates GiST spatial indexes.
- Backfills bridge, no-truck, and residential geometries from the imported JSON data.

When PostGIS is active, route hazard scoring uses route-buffer spatial queries. If PostGIS is not
active, the backend automatically falls back to PostgreSQL latitude/longitude bounding-box queries.

## Static Hazard Verification

Imported low bridges, no-truck zones, and residential zones now include production verification
fields:

- `verification_status`: `unverified`, `verified`, `needs_review`, `inactive`, or `incorrect`
- `verification_notes`
- `verified_by`
- `verified_at`
- `active`
- `location_address`
- `location_description`

Routing and map hazard lookups ignore static hazards marked `inactive` or `incorrect`. This lets a
supervisor remove bad imported records without deleting the original source record.

Protected admin API endpoints:

```text
GET /api/routing/hazard-verification/admin
GET /api/routing/hazard-verification?category=low_bridge&limit=100
PUT /api/routing/hazard-verification/:category/:id
```

Allowed categories are `low_bridge`, `no_truck`, and `residential`.

The verification admin page is map-based. Supervisors can load hazards inside the current map view,
inspect point/line/polygon geometry, and mark records as verified, needs review, inactive, or
incorrect. Supervisors can also add a driver-friendly physical address or landmark description to
records that were imported with only latitude/longitude coordinates.

The page defaults to the pilot Southwest service area: Texas, Oklahoma, New Mexico, and
Arkansas. Static hazard records also support `location_city`, `location_state`, and `state_code`.

To backfill real city/state/address values from Google reverse geocoding, run a controlled batch:

```powershell
cd "C:\dev\bridge-api\bridge-api"
$env:LOCATION_BACKFILL_CATEGORY="low_bridge"
$env:LOCATION_BACKFILL_LIMIT="50"
$env:LOCATION_BACKFILL_SCOPE="service"
npm.cmd run db:backfill:locations
```

Supported `LOCATION_BACKFILL_CATEGORY` values are `low_bridge`, `no_truck`, `residential`, and
`all`. Keep the limit small while testing because this uses the Google Geocoding API.

For production-style queue processing, queue records first and then process the queue:

```powershell
cd "C:\dev\bridge-api\bridge-api"
$env:LOCATION_BACKFILL_CATEGORY="low_bridge"
$env:LOCATION_BACKFILL_LIMIT="500"
$env:LOCATION_BACKFILL_SCOPE="service"
npm.cmd run db:queue:locations

$env:LOCATION_BACKFILL_PROCESS_LIMIT="25"
$env:LOCATION_BACKFILL_SLEEP_MS="120"
npm.cmd run db:process:locations
```

The static hazard verification page also has buttons for:

- Queueing missing city/address records for the selected hazard type and state filter
- Viewing queue stats

## Route Sessions And Replay

Every successful `POST /api/routing/safe-route` response now includes:

- `routeSessionId`
- `routeSessionLogged`
- `rerouteRecommendation`

When PostgreSQL is enabled, the backend stores the route request, selected route, route options,
truck profile, tuning values, and hazard summary in `route_sessions`.

Protected supervisor endpoints:

```text
GET /api/routing/route-sessions/admin
GET /api/routing/route-sessions?limit=75
GET /api/routing/route-sessions/stats
GET /api/routing/route-sessions/export.csv
GET /api/routing/route-sessions/:id
POST /api/routing/route-sessions/:id/events
PUT /api/routing/route-sessions/:id/review
PUT /api/routing/route-sessions/:id/archive
PUT /api/routing/route-sessions/archive
DELETE /api/routing/route-sessions/:id
DELETE /api/routing/route-sessions
```

The route replay page lets supervisors review recent routing decisions and inspect the full saved
route payload. It also renders the chosen route on a map, shows selected route hazards, and displays
driver event breadcrumbs when the mobile app sends them.

The replay page also includes supervisor analytics:

- Destination/customer search
- Last 7/30/90 day filters
- Hazard-route-only filter
- Total routes, total scored hazards, warning/event counts, and average route-option count
- CSV export for route history review
- Single-session archiving and filtered visible-session archiving
- Admin-only permanent deletion for cleanup
- Supervisor review status and notes per route session
- Event timeline controls for stepping through logged driver events on the replay map

Supported review statuses:

- `unreviewed`
- `reviewed`
- `needs_follow_up`
- `training_needed`
- `dismissed`

Role behavior:

- `supervisor`: can review route sessions, add notes, archive sessions, inspect replay maps, and export CSV.
- `admin`: can do supervisor actions plus permanently delete route sessions.

Archiving is the preferred production-safe cleanup action. Deletion should be reserved for test data
or administrator cleanup because it removes the session and associated driver events.

Driver navigation events are stored in `route_session_events`. The mobile app can record:

- Route started or recalculated
- Driver selected a different route option
- Live low-bridge or no-truck warning
- Off-route warning and reroute request
- Company speed warnings
- Arrival and route end

## Hazard Confidence And Reroute Guidance

Hazards returned by route scoring and map/proximity scans now include:

- `confidence`: high, medium, or low
- `verification_status`
- `warning_strength`

Live proximity scans also return `rerouteRecommendation`. A low bridge near the truck produces a
critical reroute recommendation, while no-truck and residential restrictions produce high/medium
recommendations.

## Important Production Note

This migration adds the database foundation and optional PostGIS spatial indexing. The PostGIS layer
is what allows the backend to query bridge and restricted-zone candidates by true route geometry
instead of only by broad latitude/longitude candidate windows.

Uploaded delivery-note photos still live on local disk. Before cloud production, move those files
to durable object storage, such as S3-compatible storage, Azure Blob Storage, or another managed
file store.
