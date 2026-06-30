class AvailabilityRepositoryPort {
  async listByStaff(_staffId) {
    throw new Error("AvailabilityRepositoryPort.listByStaff no implementado");
  }
  async listBaseScheduleByStaff(_staffId) {
    throw new Error("AvailabilityRepositoryPort.listBaseScheduleByStaff no implementado");
  }
  async create(_data) {
    throw new Error("AvailabilityRepositoryPort.create no implementado");
  }
}

module.exports = { AvailabilityRepositoryPort };
