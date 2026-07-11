# Path Risk Inventory

## Backend Path Risks

| Area | Evidence | Risk |
| --- | --- | --- |
| Static bridge data | `routes/bridges.js` and `routes/routing.js` load `../data/low_clearance_bridges.json`. | Moving route files without data folder breaks hazard/routing. |
| Manual hazards | `routes/routing.js` uses `../data/manual_hazards.json`. | Manual hazard fallback can break. |
| Recent destinations | `routes/places.js` uses `../data/recent_destinations.json`. | Places recent-destination storage can break. |
| Delivery notes | `routes/deliveryNotes.js` uses `../data/delivery_notes.json`. | Delivery notes fallback can break. |
| Local photo storage | `services/photoStorage.js` defaults to `../data/delivery_note_photos`. | Local/dev photo behavior can break. |
| Migrations | `scripts/run-migrations.cjs` reads `../migrations`. | Startup migration runner can fail. |
| Docker build context | Dockerfile copies current directory. | Wrong Render root breaks install/start. |
| Render root | root `render.yaml` uses `rootDir: bridge-api`. | Must update if backend moves to `apps/api`. |

## Mobile Path Risks

| Area | Evidence | Risk |
| --- | --- | --- |
| Expo env lookup | `app.config.js` reads `.env` from `__dirname`. | Running EAS from wrong folder misses env. |
| Android Maps key | `app.config.js` requires `EXPO_PUBLIC_ANDROID_MAPS_API_KEY` or `ANDROID_MAPS_API_KEY`. | Builds fail if env is not configured. |
| Assets | `app.json` references `./assets/icon.png` and adaptive icons. | Moving assets separately breaks native build. |
| Config plugin | `app.config.js` references `./plugins/withTruckSafeNetworkSecurity`. | Plugin path breaks if plugin folder not moved with app. |
| EAS profiles | `eas.json` is app-local. | EAS build must run from mobile app folder. |

## Repository-Level Risks

- Root `.gitignore` must not ignore committed app assets.
- Root package scripts must not mask app-level scripts.
- Duplicate `package-lock.json` files are expected if using app-local npm installs.
- Generated QR/export artifacts must not be committed.
- `.env` files must remain untracked.
