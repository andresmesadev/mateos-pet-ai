const { DomainError } = require("./domain-error");

class ChannelNotFoundError extends DomainError {
  constructor(identifier) {
    super(`El Canal "${identifier}" no existe.`);
  }
}

module.exports = { ChannelNotFoundError };
