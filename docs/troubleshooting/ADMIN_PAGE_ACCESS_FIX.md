# Administrative Page Access Fix

## Reported symptom

Opening the Daily Route Manifest administrative page at `/api/route-manifests/admin` could return:

```json
{"error":"Authentication required.","code":"AUTHENTICATION_REQUIRED"}
```

instead of redirecting the browser to the supervisor login page.

## Root cause

The private-by-default API tenant-enforcement middleware was running before server-rendered administrative routes. For unauthenticated requests it returned a JSON `401` response before routes such as `/api/route-manifests/admin` could perform their intended browser redirect to `/api/routing/manual-hazards/admin/login`.

The login route also used mounted Express path data inconsistently. Under the `/api` mount, `req.path` does not include `/api`, so public-path detection could miss `/api/routing/manual-hazards/admin/login`.

## Was the page deleted?

No. The Daily Route Manifest page still exists and is mounted.

## Source file and route

- Page renderer: `bridge-api/routes/routeManifests.js`
- Page route: `GET /api/route-manifests/admin`
- Login page route: `GET /api/routing/manual-hazards/admin/login`
- Login submit route: `POST /api/routing/manual-hazards/admin/login`
- Middleware fixed: `bridge-api/middleware/authorization.js`
- Route mount: `bridge-api/server.js` mounts route manifests at `/api/route-manifests`

## Correct local URL

```text
http://127.0.0.1:5000/api/route-manifests/admin
```

If local development uses another `PORT`, replace `5000` with that port.

## Correct deployed URL

```text
https://truck-safe-routing-api.onrender.com/api/route-manifests/admin
```

## Authentication requirements

The page is not public. Unauthenticated browser requests are redirected to the supervisor login page.

Authenticated access requires a valid admin session with the route/dashboard permissions supplied by the approved RBAC model and an Organization context for Organization-scoped operations.

JSON data endpoints remain protected and return JSON authentication errors when accessed without a valid session.

## Files changed

- `bridge-api/middleware/authorization.js`

## Validation performed

Validated locally against an isolated PostgreSQL/PostGIS database:

- `GET /health` returned `200`
- `GET /ready` returned `200`
- Unauthenticated `GET /api/route-manifests/admin` redirected to `/api/routing/manual-hazards/admin/login`
- Unauthenticated `GET /api/route-manifests/admin` also redirected when the request used `Accept: application/json`
- Unauthenticated JSON data endpoint `GET /api/route-manifests` still returned `401` with `AUTHENTICATION_REQUIRED`
- `GET /api/routing/manual-hazards/admin/login` returned the login page
- Invalid admin login returned `401` and displayed the login error
- Valid Organization-scoped supervisor login succeeded
- Authenticated supervisor session opened `/api/route-manifests/admin`
- Authenticated supervisor session opened `/api/admin`
- `npm.cmd test` passed
- `npm.cmd run test:auth-rbac` passed
- `npm.cmd run test:api-tenant` passed
- `npm.cmd run verify:secrets` passed
- `git diff --check` passed

## Remaining deployment step

Deploy the backend change to Render after review. Until deployed, the production service may continue to show the old behavior for clients that request the admin page with non-HTML headers.

## Rollback instructions

Revert the change to `bridge-api/middleware/authorization.js` that:

- normalizes public-path checks using `req.originalUrl`
- redirects unauthenticated explicit admin page `GET` requests to `/api/routing/manual-hazards/admin/login`

Rolling back restores the previous private-by-default JSON response behavior for unauthenticated admin page URLs.
