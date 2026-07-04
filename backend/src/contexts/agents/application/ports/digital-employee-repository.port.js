const SPECIALIZATIONS = [
  "recepcionista",
  "coordinador_agenda",
  "asistente_grooming",
  "asistente_recuperacion",
  "asistente_financiero",
  "asistente_administrativo",
  "asistente_clinico",
];

class DigitalEmployeeRepositoryPort {
  async create(_data) { throw new Error("DigitalEmployeeRepositoryPort.create no implementado"); }
  async findById(_id) { throw new Error("DigitalEmployeeRepositoryPort.findById no implementado"); }
  async pause(_id) { throw new Error("DigitalEmployeeRepositoryPort.pause no implementado"); }
  async reactivate(_id) { throw new Error("DigitalEmployeeRepositoryPort.reactivate no implementado"); }
  async list(_tenantId) { throw new Error("DigitalEmployeeRepositoryPort.list no implementado"); }
  async setAutonomyLimit(_digitalEmployeeId, _action, _autoApproved) {
    throw new Error("DigitalEmployeeRepositoryPort.setAutonomyLimit no implementado");
  }
  async getAutonomyLimit(_digitalEmployeeId, _action) {
    throw new Error("DigitalEmployeeRepositoryPort.getAutonomyLimit no implementado");
  }
}

module.exports = { DigitalEmployeeRepositoryPort, SPECIALIZATIONS };
