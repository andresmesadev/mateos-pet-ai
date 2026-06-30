const { DomainError } = require("./domain-error");

class InvalidCommissionInputError extends DomainError {
  constructor(reason) {
    super("INVALID_COMMISSION_INPUT", reason);
  }
}

module.exports = { InvalidCommissionInputError };
