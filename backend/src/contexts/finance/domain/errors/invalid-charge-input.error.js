const { DomainError } = require("./domain-error");

class InvalidChargeInputError extends DomainError {
  constructor(reason) {
    super("INVALID_CHARGE_INPUT", `Cobro inválido: ${reason}`);
    this.reason = reason;
  }
}

module.exports = { InvalidChargeInputError };
