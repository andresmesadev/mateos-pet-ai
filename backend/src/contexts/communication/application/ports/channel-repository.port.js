class ChannelRepositoryPort {
  async create(_data) {
    throw new Error("ChannelRepositoryPort.create no implementado");
  }
  async findByTenantAndType(_tenantId, _type) {
    throw new Error("ChannelRepositoryPort.findByTenantAndType no implementado");
  }
  async findById(_id) {
    throw new Error("ChannelRepositoryPort.findById no implementado");
  }
  async findActiveDefault(_tenantId) {
    throw new Error("ChannelRepositoryPort.findActiveDefault no implementado");
  }
  async deactivate(_id) {
    throw new Error("ChannelRepositoryPort.deactivate no implementado");
  }
  async listActive() {
    throw new Error("ChannelRepositoryPort.listActive no implementado");
  }
}

module.exports = { ChannelRepositoryPort };
