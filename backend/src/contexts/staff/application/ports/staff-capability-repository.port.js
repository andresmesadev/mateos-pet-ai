class StaffCapabilityRepositoryPort {
  async listActiveByStaff(_staffId) {
    throw new Error("StaffCapabilityRepositoryPort.listActiveByStaff no implementado");
  }
  async listActiveByService(_serviceId) {
    throw new Error("StaffCapabilityRepositoryPort.listActiveByService no implementado");
  }
  async create(_data) {
    throw new Error("StaffCapabilityRepositoryPort.create no implementado");
  }
  async revoke(_staffId, _serviceId) {
    throw new Error("StaffCapabilityRepositoryPort.revoke no implementado");
  }
}

module.exports = { StaffCapabilityRepositoryPort };
