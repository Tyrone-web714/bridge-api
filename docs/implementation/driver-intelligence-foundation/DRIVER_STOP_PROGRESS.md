# Driver Stop Progress

Stop progress evaluates current stop evidence and stop events.

- The arrival threshold is 30 yards from the current stop point.
- The departure threshold is 60 yards from the current stop point.
- `STOP_ARRIVED`, an `AT_STOP`/`DELIVERING` state, or current position within the arrival threshold records arrival progress.
- `STOP_DEPARTED` or current position beyond the departure threshold after departure evidence records departure progress.
- Missing stop context is `NOT_APPLICABLE`.
- Missing stop geometry is `INSUFFICIENT_EVIDENCE`.
- A stop with no arrival or departure evidence is `REVIEW_REQUIRED`.

Duplicate and out-of-order events are sorted deterministically by timestamp and event type before the latest stop event is interpreted. Arrival or departure does not infer delivery completion without required delivery evidence. No delivery note, inventory, or route manifest data is mutated.
