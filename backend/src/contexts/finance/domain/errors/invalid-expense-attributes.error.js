const { DomainError } = require("./domain-error");

class InvalidExpenseAttributesError extends DomainError {
  constructor(reason) {
    super("INVALID_EXPENSE_ATTRIBUTES", `Gasto inválido: ${reason}`);
    this.reason = reason;
  }
}

module.exports = { InvalidExpenseAttributesError };
