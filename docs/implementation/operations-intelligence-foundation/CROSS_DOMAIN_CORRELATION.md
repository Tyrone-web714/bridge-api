# Cross-Domain Correlation

Correlation means known facts co-occur within a supported operational relationship such as a shared route. It is not causation. Operations Intelligence never infers root cause unless lower-domain evidence explicitly proves it.

Regression coverage: normal co-occurrence of healthy lower-domain facts must remain a correlation candidate only and must not emit `CROSS_DOMAIN_OPERATIONAL_CONFLICT` or any other operations exception. The `no_exception_case` synthetic benchmark and `NORMAL_COOCCURRENCE_FALSE_EXCEPTION` mutation check enforce this defect boundary.
