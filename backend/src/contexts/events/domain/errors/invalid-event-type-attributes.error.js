const { DomainError } = require("./domain-error");

class InvalidEventTypeAttributesError extends DomainError {
  constructor(reason) {
    super(reason);
  }
}

module.exports = { InvalidEventTypeAttributesError };
