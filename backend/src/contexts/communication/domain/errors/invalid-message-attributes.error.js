const { DomainError } = require("./domain-error");

class InvalidMessageAttributesError extends DomainError {
  constructor(reason) {
    super(reason);
  }
}

module.exports = { InvalidMessageAttributesError };
