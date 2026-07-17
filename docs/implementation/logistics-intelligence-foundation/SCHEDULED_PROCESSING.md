# Scheduled Processing

The foundation supports deterministic processing through run keys.

Run keys prevent duplicate rows for signals, findings, and recommendations.

This phase does not introduce a production scheduler. Future scheduling can call the existing processing service with bounded limits and the same idempotency behavior.
