function cleanOrganizationName(value) {
  return String(value || '').trim().slice(0, 120);
}

const organizationName =
  cleanOrganizationName(process.env.ORGANIZATION_NAME) || 'TruckSafe Routing';

module.exports = {
  organizationName
};
