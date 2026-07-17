# Signal Model

Signals are deterministic observations derived from canonical logistics events.

Signals are stored in `logistics_signals` and include signal type, subject, severity, confidence, explanation, source event IDs, lineage, and run key.

Signal generation is repeatable. The same Organization, event, and signal type resolve to the same run key and do not create duplicates.
