# Enterprise Identity Foundation

Status: FOUNDATION IMPLEMENTED / PROVIDER INTEGRATION NOT VERIFIED.

This implementation establishes the ODR-020 foundation for tenant-scoped enterprise identity federation without replacing existing pilot authentication.

The preserved identity chain is:

External Federated Identity -> Internal TSR User -> Organization Membership -> Approved TSR Role -> Explicit Permissions -> Authorized Resource Access.

Microsoft Entra ID, Okta, Google Workspace, generic OIDC, and generic SAML remain not provider verified.

