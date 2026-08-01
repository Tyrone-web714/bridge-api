# Restricted Road Approach

Restricted road approach detection evaluates supplied upcoming restriction evidence near the current position.

Recognized warnings:

- `TRUCK_PROHIBITED`
- `NO_THROUGH_TRUCKS`
- `RESIDENTIAL_AVOID`
- `RESIDENTIAL_TRUCK_PROHIBITED`
- `ROAD_CLOSED`

Truck-prohibited, residential-truck-prohibited, and road-closure approaches require human review. No-through-truck restrictions require human review for through routes, but a supplied `LOCAL_DELIVERY` route purpose is handled as an advisory local-delivery exception rather than an absolute ban. Residential-area presence alone is advisory and is not treated as illegal without explicit prohibition evidence.
