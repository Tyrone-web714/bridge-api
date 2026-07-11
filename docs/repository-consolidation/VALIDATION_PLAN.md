# Consolidation Validation Plan

## Backend Gates

From API app folder:

```powershell
npm ci
npm test
npm run verify:secrets
npm run verify:production
npm start
```

Runtime checks:

- `GET /health` returns `ok: true`.
- `GET /ready` returns `ok: true` in target environment.
- Routing endpoint works.
- Static low-clearance bridge data loads.
- Database access works.
- PostGIS readiness passes.
- Route manifest admin page loads.
- Driver assigned-route lookup still uses driver ID/company driver number model.
- Delivery notes/photo storage paths work.
- Admin/supervisor dashboard pages load.

## Mobile Gates

From mobile app folder:

```powershell
npm ci
npm run verify:secrets
npm run verify:production
npm start
npm run export:android:preview
```

Required checks:

- Expo config resolves.
- EAS config validates.
- Android Maps key resolves.
- `plugins/withTruckSafeNetworkSecurity` resolves in development builds.
- App starts in dev client.
- Auth/session flow works.
- Assigned route cache works.
- Offline queues remain readable.
- Map and truck marker assets load.
- Zebra/Bluetooth native dependency remains installable.

## Repository Gates

- `git status --short` clean after planned commit.
- No `.env` files staged.
- No QR/APK/AAB/export/cache artifacts staged.
- No `node_modules/` staged.
- Documentation links valid.
- Render root path valid.
- Docker build context valid.
- Mobile EAS commands documented with correct working directory.
