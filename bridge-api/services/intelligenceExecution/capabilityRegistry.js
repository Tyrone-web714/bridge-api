const enterpriseRegistry = require('./enterpriseCapabilityRegistry');

function getCapability(id) {
  return enterpriseRegistry.getRuntimeCapability(id);
}

function listCapabilities() {
  return enterpriseRegistry.listRuntimeCapabilities();
}

module.exports = {
  getCapability,
  listCapabilities
};
