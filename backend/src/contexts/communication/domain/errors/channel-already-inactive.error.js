const { DomainError } = require("./domain-error");

class ChannelAlreadyInactiveError extends DomainError {
  constructor(identifier) {
    super(`El Canal "${identifier}" ya está desactivado.`);
  }
}

module.exports = { ChannelAlreadyInactiveError };
