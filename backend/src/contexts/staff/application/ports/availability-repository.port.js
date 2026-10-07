class AvailabilityRepositoryPort {
  async findById(_id) { throw new Error('AvailabilityRepositoryPort.findById no implementado'); }
  async voidCurrent(_id,_data) { throw new Error('AvailabilityRepositoryPort.voidCurrent no implementado'); }
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
