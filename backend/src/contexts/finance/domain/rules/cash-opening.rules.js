class CashOpeningError extends Error {
  constructor(message, status = 400) { super(message); this.code = 'CASH_OPENING'; this.status = status; }
}
function validCashAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 99999999.99 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}
module.exports = { CashOpeningError, validCashAmount };
