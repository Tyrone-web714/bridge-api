# Dataset Source and Attribution

## OpenStreetMap / Overpass

Restricted-zone build scripts query OpenStreetMap through Overpass API.
OpenStreetMap data is available under the Open Database License (ODbL).
Produced maps must display `OpenStreetMap contributors`; distributed derived
databases may trigger ODbL share-alike obligations and require legal review.

- Source: https://www.openstreetmap.org/copyright
- Query mechanism: `scripts/build-zones-regions.cjs`
- Runtime attribution is present on Leaflet map surfaces.
- Record the query date, bounding boxes, Overpass endpoint, and script commit for
  every generated release dataset.

## Low-Clearance Bridges

`scripts/build-bridges.cjs` builds low-clearance candidates from the United
States Federal Highway Administration National Bridge Inventory. NBI data is a
United States government source; confirm the current download terms and source
metadata for each release. Imported records are operational candidates and
require supervisor verification before being treated as authoritative.

- Source portal: https://www.fhwa.dot.gov/bridge/nbi.cfm
- Build script: `scripts/build-bridges.cjs`
- Preserve source file date, URL, checksum, filters, script commit, and reviewer.

Neither dataset is a warranty that a road is suitable for a particular truck.
Driver observations and supervisor verification remain operational controls.
