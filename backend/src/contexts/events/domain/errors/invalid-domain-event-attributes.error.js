const { DomainError } = require("./domain-error");

class InvalidDomainEventAttributesError extends DomainError {
  constructor(reason) {
    super(reason);
  }
}

module.exports = { InvalidDomainEventAttributesError };
