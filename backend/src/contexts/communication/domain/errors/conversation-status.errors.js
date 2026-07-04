const { DomainError } = require("./domain-error");

class ConversationAlreadyEscalatedError extends DomainError {
  constructor(conversationId) {
    super(`La conversación "${conversationId}" ya está esperando atención humana.`);
  }
}

class ConversationNotEscalatedError extends DomainError {
  constructor(conversationId) {
    super(`La conversación "${conversationId}" no está escalada; no hay nada que resolver.`);
  }
}

module.exports = { ConversationAlreadyEscalatedError, ConversationNotEscalatedError };
