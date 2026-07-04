const { DomainError } = require("./domain-error");

class ConversationNotFoundError extends DomainError {
  constructor(identifier) {
    super(`La conversación "${identifier}" no existe.`);
  }
}

module.exports = { ConversationNotFoundError };
