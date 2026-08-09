# Route Progress Model

Route progress is derived from completed, remaining, and unresolved stop counts. Unknown or invalid stop counts produce unknown progress instead of fabricated precision.

Delay detection is deterministic. A route without actual start after the configured threshold produces a route-start delay. A started route with positive progress delay minutes produces a progress-delay exception.

The model is operational visibility only and does not score driver performance.
