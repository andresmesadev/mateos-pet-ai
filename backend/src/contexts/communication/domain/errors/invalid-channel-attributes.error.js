const { DomainError } = require("./domain-error");

class InvalidChannelAttributesError extends DomainError {
  constructor(reason) {
    super(reason);
  }
}

module.exports = { InvalidChannelAttributesError };
