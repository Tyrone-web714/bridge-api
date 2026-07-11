# Mobile File Classification

| Category | Count |
| --- | ---: |
| A. Source code | 98 |
| B. Required runtime assets | 8 |
| C. Build/configuration files | 13 |
| D. Compliance and documentation | 7 |
| E. Generated artifacts | 791 |
| F. Local caches | 26793 |
| G. Sensitive/local-only configuration | 2 |
| H. Unknown and requiring review | 39 |

Detailed classification CSV: `raw/mobile-file-classification.csv`.

## Category Rules

- A. Source code: `src/`, `App.js`, `index.js`.
- B. Required runtime assets: app assets required by Expo or runtime screens.
- C. Build/configuration files: package files, Expo/EAS config, plugins, scripts, `.github`, `.gitignore`.
- D. Compliance and documentation: compliance outputs, license notices, road-test/project docs.
- E. Generated artifacts: QR PNGs, APK/AAB files, Expo exports, preview/contact-sheet images.
- F. Local caches: `node_modules/`, `.expo/`.
- G. Sensitive/local-only configuration: `.env*` files.
- H. Unknown and requiring review: files not confidently classified by RC-0 rules.

No files were moved or deleted.
