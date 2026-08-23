# Pilot Wave 0 Next Implementation Package

Recommended Pilot Wave 1 package:

Validator and Environment Readiness Normalization

## Purpose

Close the first internally controllable blocker cluster without touching production systems:

- Reconcile the stale `validate:production-rollout` migration expectation with valid migrations 011 and 012.
- Create a pilot environment readiness checklist that maps required owner-provided values.
- Define a safe isolated `validate:pilot-integration` execution profile.
- Preserve D1 OFF and D2 production routing disabled.

## Why This Comes Next

The live pilot cannot proceed until owner decisions are made, but engineering can shorten
the path by removing false validation noise and making environment/test prerequisites exact.
This work is small, internally controllable, and reduces risk before any physical or
production-like validation.

## Scope

Allowed:

- Update stale validator expectations for legitimate migrations 011 and 012.
- Add or update documentation for pilot environment variables and safe test isolation.
- Add non-mutating checks if they only validate readiness documentation.
- Run non-mutating repository validations.

Not allowed without separate approval:

- Configure production or pilot secrets.
- Run `validate:pilot-integration`.
- Deploy.
- Migrate.
- Build or distribute mobile artifacts.
- Activate D2 production routing.
- Enable D1.

## Exit Criteria

- `validate:production-rollout` no longer fails on valid migrations 011 and 012.
- Environment findings are documented as owner/configuration inputs, not code defects.
- Safe-run requirements for `validate:pilot-integration` are explicit.
- Working tree remains reviewable with no production changes.
