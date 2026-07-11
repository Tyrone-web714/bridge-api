# Driver Auth Compatibility

Mobile compatibility is preserved:

- The mobile app may continue accepting the company driver number.
- The backend resolves the authenticated session to Organization ID and internal driver ID.
- Responses now include additive identity fields where useful:
  - `companyDriverNumber`
  - `internalDriverId`
  - `organizationId`

Driver names are not identifiers. Company driver numbers are not globally unique.
