# Offline Queue Tenant Rules

Every queued operation now carries:

- `organizationId`
- `internalDriverId`
- `companyDriverNumber`
- `payloadVersion`
- operation ID
- created timestamp
- retry metadata
- route/stop IDs where applicable

Before read, flush, remove, or failure marking, the queue is resolved using trusted current session context or the queued operation tenant context.

Cross-tenant protections:

- Organization A queue keys differ from Organization B keys.
- Driver A queue keys differ from Driver B keys.
- Queue readers filter records with `operationMatchesTenant`.
- Mismatched legacy records are quarantined.
- Failed operations are preserved with retry metadata.