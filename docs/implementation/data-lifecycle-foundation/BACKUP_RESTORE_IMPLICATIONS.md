# Backup and Restore Implications

`lifecycle_tombstones` records deletion, anonymization, and purge facts for post-restore reconciliation.

The platform does not claim immediate physical erasure from immutable backups. Production restore procedures must replay lifecycle state and tombstones after restore where required.
