# Census TIGER/Line City Metadata

Truck-Safe Routing uses Census TIGER/Line PLACE boundaries to attach city/place metadata to static hazards.

## Source

The importer uses official Census TIGER/Line PLACE shapefiles:

- Texas: `tl_2025_48_place.zip`
- Oklahoma: `tl_2025_40_place.zip`
- New Mexico: `tl_2025_35_place.zip`
- Arkansas: `tl_2025_05_place.zip`

Source folder:

`https://www2.census.gov/geo/tiger/TIGER2025/PLACE/`

## Import

PostGIS must be enabled first:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm.cmd run db:postgis:init
```

Then download and import Census PLACE boundaries:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm.cmd run census:places:sync
```

This creates and populates:

`census_places`

The script uses the local PostGIS tools:

- `C:\Program Files\PostgreSQL\17\bin\shp2pgsql.exe`
- `C:\Program Files\PostgreSQL\17\bin\psql.exe`

If PostgreSQL is installed somewhere else, set:

- `SHP2PGSQL_PATH`
- `PSQL_PATH`

## Backfill

After import, backfill hazard city metadata:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm.cmd run db:backfill:city-metadata
```

This updates:

- `low_clearance_bridges.location_city`
- `low_clearance_bridges.location_state`
- `low_clearance_bridges.state_code`
- `truck_restricted_zones.location_city`
- `truck_restricted_zones.location_state`
- `truck_restricted_zones.state_code`

It does not overwrite existing supervisor-entered city fields unless:

```powershell
$env:CITY_BACKFILL_OVERWRITE="true"
npm.cmd run db:backfill:city-metadata
```

## Verify

Run:

```powershell
cd "C:\dev\bridge-api\bridge-api"
npm.cmd run data:audit:coverage
```

City counts should increase for low bridges, no-truck zones, and residential zones after the backfill.

## Limits

Census PLACE boundaries provide city/place names, not exact street addresses. Exact street addresses still require Google reverse geocoding or supervisor-entered corrections.
