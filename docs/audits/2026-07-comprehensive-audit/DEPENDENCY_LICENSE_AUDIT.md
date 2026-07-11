# Dependency, License, and Supply-Chain Audit

## Inventories

See `dependencies.csv`.

## Audit Results

- Backend: `npm audit --json` returned zero vulnerabilities.
- Mobile: `npm audit --json` returned 1 low and 11 moderate vulnerabilities. Chains include Expo config/CLI tooling, Babel core, brace-expansion, js-yaml, uuid/xcode.

## License Notes

Direct dependencies appear to be common permissive ecosystem packages, but this audit does not replace legal review. Compliance notices and SBOMs should be regenerated before external pilot or commercialization.

## Recommendations

- Do not run `npm audit fix` blindly against Expo/React Native.
- Upgrade only through an Expo-compatible path.
- Remove or isolate generated build artifacts from source governance.
- Continue preserving truck sprite provenance records.
