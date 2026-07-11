# API Compatibility

This phase preserves existing mobile and supervisor behavior where practical.

Current driver-facing workflows may continue accepting and displaying the company driver number. Backend relationships can now resolve toward the permanent internal driver ID and Organization context.

Updated foundational paths include:

- Driver lookup and authentication record lookup
- Driver session creation
- Driver registry listing/upsert foundation
- Daily route manifest upload foundation
- Daily route stop replacement foundation
- Daily route manifest listing
- Route assignment, unassignment, swap, delete, and assigned-route lookup
- Daily route manifest with account intelligence child reads

## Compatibility Fallback

For existing workflows that do not yet carry Organization claims, repository calls explicitly allow fallback to the bootstrap Development Organization.

## Remaining API Work

Full private-by-default authorization, authenticated Organization claims, Platform Admin support workflows, and fine-grained permission enforcement remain future phases.
