# Capability Registry Integration

Dataset validation consumes the Enterprise Intelligence Capability Registry from `bridge-api/services/intelligenceExecution/enterpriseCapabilityRegistry.js`. Each dataset must reference a known capability, supported capability version, and compatible input/output schema IDs.

Dataset presence does not activate disabled capabilities, approve production use, or change runtime behavior.
