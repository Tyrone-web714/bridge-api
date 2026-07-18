# Rollback Procedure

Preferred rollback is application rollback plus corrective forward migration if needed.

Production rollback must not blindly drop lifecycle tables after data has been written. If migration `009` has been applied in an environment and must be backed out before production use, preserve tables or export their contents first, then use an owner-approved rollback plan.

Audit event immutability trigger can be disabled only through approved database administration and documented recovery procedure.

Preview-linked purge job records should be preserved during rollback analysis because they are lifecycle audit/control evidence.
