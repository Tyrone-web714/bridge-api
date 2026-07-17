# TSR Retention and Purge Engine Architecture

**Status:** ARCHITECTURE DESIGNED
**Implementation State:** FOUNDATION NOT IMPLEMENTED

The retention and purge engine SHALL evaluate:

`data_class -> retention rule -> legal hold status -> purge eligibility -> action`

The engine SHALL support impact preview, dry-run where practical, tenant scoping, idempotent purge jobs, resumable execution, audit logging, object-storage coordination, and failure recovery.

The engine SHALL NOT hard-delete historically significant records unless an approved policy and Cascade Map classification permit it.
