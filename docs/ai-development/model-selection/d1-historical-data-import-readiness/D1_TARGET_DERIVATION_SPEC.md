# D1 Target Derivation Spec

Status: TARGET_DERIVATION_DEFINED_NO_LABELS_DERIVED

Source systems do not need to provide final ML labels if canonical history can derive them reproducibly.

## Route Completion

`targetDefinitionVersion`: `d1-route-completion-target-v0.1-draft`

Candidate target derivation:

- Route completed if canonical route status is completed or completed_with_exceptions and `actual_completion_at` is valid.
- Completion timestamp is route-level `actual_completion_at` when supplied and valid.
- If route-level completion is absent, a future approved rule may derive from the latest terminal stop timestamp.
- Cancelled, aborted, duplicate, negative-duration, extreme-duration, multi-day, or ambiguous routes are excluded or quarantined until an approved rule exists.

## Delivery Failure Risk

`targetDefinitionVersion`: `d1-delivery-failure-target-v0.1-draft`

Candidate target derivation:

- Preserve canonical outcome first.
- Delivered outcomes default to negative.
- Customer unavailable/refused, time-window failure, inventory shortfall, route operation failure, vehicle failure, and no-payment outcomes are candidate positives.
- Partial delivery, cancelled, rescheduled, and unknown outcomes require explicit target rule before binary labeling.

## Leakage Rule

Target/post-outcome fields must not be available as predictive features for predictions made before the delivery attempt or route completion.
