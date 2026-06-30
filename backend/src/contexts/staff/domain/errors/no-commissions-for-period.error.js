const { DomainError } = require("./domain-error");

class NoCommissionsForPeriodError extends DomainError {
  constructor(staffId, periodStart, periodEnd) {
    super(
      "NO_COMMISSIONS_FOR_PERIOD",
      `El miembro del staff "${staffId}" no tiene comisiones registradas entre ${periodStart} y ${periodEnd}.`
    );
    this.staffId = staffId;
    this.periodStart = periodStart;
    this.periodEnd = periodEnd;
  }
}

module.exports = { NoCommissionsForPeriodError };
