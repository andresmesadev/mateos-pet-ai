class ConversationRepositoryPort {
  async findOrCreateActiveForUser(_userId, _channelId) {
    throw new Error("ConversationRepositoryPort.findOrCreateActiveForUser no implementado");
  }
  async findById(_id) {
    throw new Error("ConversationRepositoryPort.findById no implementado");
  }
  async escalate(_conversationId) {
    throw new Error("ConversationRepositoryPort.escalate no implementado");
  }
  async resolveEscalation(_conversationId) {
    throw new Error("ConversationRepositoryPort.resolveEscalation no implementado");
  }
  async listEscalatedPending(_tenantId) {
    throw new Error("ConversationRepositoryPort.listEscalatedPending no implementado");
  }
}

module.exports = { ConversationRepositoryPort };
