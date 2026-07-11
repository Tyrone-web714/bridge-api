# Secret Finding Classification

RC-0 reported 52 secret-screening findings. RC-1 classifies them by commit risk without printing secret values.

## RC-0 Severity Summary

- Backend Critical findings: 5
- Backend High findings: 30
- Backend Medium findings: 1
- Mobile High findings: 10
- Mobile Medium findings: 6

## RC-1 Classification Summary

- Sensitive value in untracked local environment file: backend `.env` findings and mobile `.env` findings. These are not proposed for staging.
- Placeholder/example environment reference: `.env.example` and deployment example files. These are safe only when they contain placeholders rather than real values.
- Client/build configuration reference: Expo, EAS, and Android Maps references. These may be committed only when they are intended client metadata and the Google Maps key is properly restricted.
- Documentation or deployment example reference: docs and deployment instructions that mention environment variable names or placeholder examples.
- Variable name or code reference only: code references to token/password/API-key field names without embedded secret values.

## Real Secrets Found Without Values

The following are real sensitive locations by file/type only. Values are intentionally omitted.

- Backend local environment file: `C:\dev\bridge-api\bridge-api\.env`
- Mobile local environment file: `C:\dev\tsr-mobile\.env`

No real secret value is proposed for commit. Both files are local-only and must remain excluded from Git.

## Commitment Risk

- Sensitive local `.env` files are not proposed for staging and are protected by `.gitignore`.
- `.env.example` files are acceptable only with placeholder values.
- Code references such as variable names, token parameter names, or password field names are not secrets by themselves.
- Public Expo configuration values can be committed only when they are meant to be visible in the mobile client.
- Any shared API token or client-exposed operational token remains a production security concern even if excluded from the baseline commit.

## Treatment Rules

| Classification | Safe To Commit | Required Treatment | Blocking RC-1 |
|---|---:|---|---:|
| Sensitive value in untracked local environment file | No | Exclude from Git; store only in local/EAS/Render secret storage; rotate if exposed | No, because excluded |
| Placeholder/example environment reference | Yes | Keep placeholder names only; no real values | No |
| Client/build configuration reference | Conditional | Ensure value is public client metadata or properly restricted platform key | No |
| Documentation or deployment example reference | Yes | Preserve guidance; ensure examples are placeholders | No |
| Variable name or code reference only | Yes | Keep implementation reference; no action unless value is embedded | No |

## Open Security Note

If a shared driver API token still exists in any client environment, it must be retired or replaced before production. RC-1 does not implement authentication changes; it only protects the mobile source-control baseline from committing local secret values.
