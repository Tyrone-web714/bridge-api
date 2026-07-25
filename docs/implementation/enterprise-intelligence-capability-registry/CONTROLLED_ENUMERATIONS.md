# Controlled Enumerations

Controlled enums are defined in `enterpriseCapabilityRegistry.js` and reuse existing repository execution strategy constants from `constants.js`.

Repository equivalents are preserved: `SQL_ANALYTICS` covers SQL/database aggregation, `STATISTICAL_MODEL` covers formula/statistical computation, and `MULTI_MODEL_WORKFLOW` covers multi-strategy workflow naming already used by the IEP.

No capability may use `AUTONOMOUS` decision nature without explicit owner approval metadata.
