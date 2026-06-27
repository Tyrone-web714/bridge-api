# Google Maps Platform Compliance Record

Review date: 2026-06-27

This is an engineering compliance record, not legal advice. Counsel and the
Google Maps Platform account owner must approve the unresolved items before a
commercial production release.

## Services In Use

- Maps SDK for Android through `react-native-maps`
- Directions API (Legacy)
- Places API (New), including Autocomplete and Place Details
- Place Photos (New)
- Geocoding API
- Street View Static API and Google Maps Street View links
- Google traffic display through Maps SDK for Android

## Implemented Controls

- Recent destinations persist only the selected destination text, Place ID,
  and save time. Place IDs are the Google identifier explicitly permitted for
  indefinite storage.
- Existing persisted recent-destination photos, photo resource names, Street
  View URLs, phone data, and Places enrichment are purged during database
  initialization.
- File-based recent-destination fallback data is sanitized on read and rewrite.
- Place Photo and Street View proxy responses use `Cache-Control: no-store`.
- Mobile autocomplete predictions are no longer cached between requests.
- Places and photo surfaces identify Google Maps. Live photo-author
  attributions returned by Places API are displayed and linked.
- Directions results are rendered on Google Maps in the mobile application.
- Route Replay uses driver-device `gps_trace` events and customer operational
  events. New Google route geometry, route summaries, planned distance,
  duration, and derived planned-route hazard payloads are not persisted.
- Existing persisted Google route options and endpoint coordinates are purged
  during database initialization while customer-owned event history and
  supervisor reviews remain.

## Retention Classification

| Data | Source | Current retention | Status |
|---|---|---:|---|
| Place ID | Google Places | Indefinite | Permitted identifier |
| User-selected destination text | End-user transaction | Recent 12 | Retained for driver workflow |
| Place photos and photo resource names | Google Places | Not persisted | Remediated |
| Street View image/URL | Google | Not persisted | Remediated |
| Autocomplete predictions | Google Places | Active UI request only | Remediated |
| Directions route options and encoded geometry | Google Directions | Live navigation response only | Not persisted |
| Geocoded hazard address/coordinates | Google Geocoding | Database | **Unresolved classification** |
| Driver GPS trace and delivery events | Customer operational data | Database | Customer-controlled |

## Release Blockers

1. Obtain counsel review of the current Google Maps Platform Terms, Service
   Specific Terms, Directions policies, Places policies, Street View policies,
   and applicable regional terms.
2. Obtain written Google confirmation that the intended truck/heavy-vehicle
   routing and turn-guidance implementation is permitted. Do not assume the
   standard consumer/navigation grant covers restricted-truck navigation.
3. Classify hazard metadata created using Google-geocoded coordinates. Confirm
   whether it qualifies for an applicable caching exception or replace the
   geocoding source with a dataset licensed for persistent derivative use.
4. Publish public Terms of Use and Privacy Policy pages that reference the
   Google Maps/Google privacy terms as required, then link them from the mobile
   app settings and distribution listing.
5. Verify Google Cloud key restrictions:
   - Android key restricted to the production package and signing certificate.
   - Server keys restricted by API and, where supported, server identity/IP.
   - Separate least-privilege keys for Directions, Places, Geocoding, Street
     View Static, and Maps Embed.
6. Confirm Google Maps attribution and third-party attribution remain visible
   at every supported screen size and are not covered by route controls.

## Authoritative References

- https://cloud.google.com/maps-platform/terms
- https://cloud.google.com/maps-platform/terms/maps-service-terms
- https://developers.google.com/maps/documentation/directions/policies
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://developers.google.com/maps/documentation/places/web-service/place-photos
- https://developers.google.com/maps/documentation/streetview/policies
- https://developers.google.com/maps/documentation/navigation/android-sdk/policies
