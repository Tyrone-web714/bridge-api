# Current Repository State

## Backend Repository

| Item | Current value |
| --- | --- |
| Local root | `C:\dev\bridge-api` |
| Backend app | `C:\dev\bridge-api\bridge-api` |
| Branch | `main` |
| Remote | `origin https://github.com/Tyrone-web714/bridge-api.git` |
| Baseline commit inspected | `bbb312618953018d7f13f791935d9664fae7f433` |
| Working tree | Clean after governance baseline commit/push at inspection time. |
| Package manager | npm with `package-lock.json`. |
| Runtime | Node/Express, CommonJS, Node `>=18`; Docker uses `node:20-alpine`. |
| Deployment | Render Docker service; root `render.yaml` uses `rootDir: bridge-api`; backend folder also contains `render.yaml`. |
| Documentation | Governing docs under `docs/`; architecture baseline v1.0 approved. |

Backend capabilities include API routes, server-rendered supervisor/admin dashboard, PostgreSQL/PostGIS data access, migrations, routing and hazard logic, delivery notes/photos, object storage abstraction, Render/Docker deployment, and production verification scripts.

## Active Mobile Repository

| Item | Current value |
| --- | --- |
| Local root | `C:\dev\tsr-mobile` |
| Branch | `master` |
| Remote | None returned by `git remote -v`. |
| Working tree | Modified and untracked files present. |
| Package manager | npm with `package-lock.json`. |
| Runtime | Expo / React Native. |
| Build system | EAS with `eas.json`; preview and production point at `https://truck-safe-routing-api.onrender.com`. |
| Native constraints | `react-native-bluetooth-classic`, `react-native-maps`, Expo config plugins, Android Maps key injection. |

Mobile dirty state includes modified app/config/assets/package files and untracked `.github/`, `app.config.js`, `src/`, `scripts/`, `plugins/`, compliance files, runtime assets, QR images, preview images, and Expo export folders.

## Older Or Experimental Folders

| Folder | Evidence |
| --- | --- |
| `C:\dev\truck-safe-routing` | Vite/React-style folder, no `.git` observed in listing, not authoritative. |
| `C:\dev\truck-safe-routing-mobile` | Expo-style folder with `.git`, but Git inspection hit Windows ownership protection; not authoritative. |

Do not import older folders unless a separate evidence review proves a file or feature exists only there and is still required.
