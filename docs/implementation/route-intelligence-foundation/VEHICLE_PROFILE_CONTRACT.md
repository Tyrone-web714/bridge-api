# Vehicle Profile Contract

Vehicle profiles require server-derived tenant context plus vehicleId, height, and gross weight. Width, length, axle count, hazmat, and trailer type are optional evidence inputs. Caller supplied provider, model, premium, or execution override fields are rejected.


The contract records vehicle type/class, measurement source, confidence, safety buffer, effective routing height, trailer attributes, operational restrictions, authoritative fields, unknown fields, validation status, and test-only state. Unknown values remain unknown and are never converted to zero.
