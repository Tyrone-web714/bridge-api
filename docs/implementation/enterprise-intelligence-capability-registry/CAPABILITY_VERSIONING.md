# Capability Versioning

Each capability distinguishes stable capability ID, capability contract version, input schema ID, output schema ID, prompt version, benchmark version, policy version, and executor version.

Documentation wording changes do not require a contract version increment. Required input or output semantic changes require a major contract version. Provider changes without behavior change do not require capability version changes. Prompt changes that affect output behavior change prompt version metadata.
