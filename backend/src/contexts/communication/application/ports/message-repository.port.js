class MessageRepositoryPort {
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
