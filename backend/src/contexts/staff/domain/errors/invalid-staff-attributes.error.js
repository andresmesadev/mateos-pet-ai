const { DomainError } = require("./domain-error");

class InvalidStaffAttributesError extends DomainError {
  constructor(reason) {
    super("INVALID_STAFF_ATTRIBUTES", reason);
  }
}

module.exports = { InvalidStaffAttributesError };
