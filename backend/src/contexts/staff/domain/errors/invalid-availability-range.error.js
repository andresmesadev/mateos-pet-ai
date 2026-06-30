const { DomainError } = require("./domain-error");

class InvalidAvailabilityRangeError extends DomainError {
  constructor(reason) {
    super("INVALID_AVAILABILITY_RANGE", reason);
  }
}

module.exports = { InvalidAvailabilityRangeError };
