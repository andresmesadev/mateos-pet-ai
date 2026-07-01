const { DomainError } = require("./domain-error");

class ExpenseNotFoundError extends DomainError {
  constructor(expenseId) {
    super("EXPENSE_NOT_FOUND", `No existe un gasto con id "${expenseId}".`);
    this.expenseId = expenseId;
  }
}

module.exports = { ExpenseNotFoundError };
