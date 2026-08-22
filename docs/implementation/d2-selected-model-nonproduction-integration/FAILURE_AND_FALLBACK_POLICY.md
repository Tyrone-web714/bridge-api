# Failure And Fallback Policy

Selected-D2 execution fails closed.

If provider execution fails, the response is:

`DEGRADED_UNAVAILABLE`

The fallback response preserves authoritative evidence, reports provider failure metadata, and does not fabricate AI output. It never silently calls an unselected model or bypasses runtime hard gates.

If runtime gates fail, the model output is rejected.
