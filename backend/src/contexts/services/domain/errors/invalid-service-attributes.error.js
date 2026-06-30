const { DomainError } = require("./domain-error");

class InvalidServiceAttributesError extends DomainError {
  constructor(reason) {
    super("INVALID_SERVICE_ATTRIBUTES", reason);
  }
}

module.exports = { InvalidServiceAttributesError };
