# Rollback Procedure

Migration 010 is additive. Application rollback can remove the route mount and service usage while leaving tables in place.

Destructive database rollback is not recommended after identity events or federated mappings exist.

If rollback is required, disable IdP configurations, stop SSO entry endpoints, preserve audit records, and retain migration 010 tables until legal and operational review approves disposal. Migration 010 is already applied in production, so database rollback should be treated as a production recovery action requiring backup/restore approval rather than an ad hoc down migration.

