const { DomainError } = require("./domain-error");

class ExpenseAlreadyVoidedError extends DomainError {
  constructor(expenseId) {
    super("EXPENSE_ALREADY_VOIDED", `El gasto "${expenseId}" ya fue anulado previamente.`);
    this.expenseId = expenseId;
  }
}

module.exports = { ExpenseAlreadyVoidedError };
