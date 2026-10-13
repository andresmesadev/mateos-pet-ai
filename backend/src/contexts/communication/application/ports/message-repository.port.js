class MessageRepositoryPort {
  async findLatestIncomingAt(_userId, _tenantId) {
    throw new Error("MessageRepositoryPort.findLatestIncomingAt no implementado");
  }

  async create(_data) {
    throw new Error("MessageRepositoryPort.create no implementado");
  }
  async listByConversation(_conversationId) {
    throw new Error("MessageRepositoryPort.listByConversation no implementado");
  }
  async listByUser(_userId) {
    throw new Error("MessageRepositoryPort.listByUser no implementado");
  }
}

module.exports = { MessageRepositoryPort };
