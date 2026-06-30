class StaffRepositoryPort {
  async findById(_staffId) {
    throw new Error("StaffRepositoryPort.findById no implementado");
  }
  async create(_data) {
    throw new Error("StaffRepositoryPort.create no implementado");
  }
  async update(_staffId, _data) {
    throw new Error("StaffRepositoryPort.update no implementado");
  }
  async listActive(_filter) {
    throw new Error("StaffRepositoryPort.listActive no implementado");
  }
}

module.exports = { StaffRepositoryPort };
