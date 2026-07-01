const { DomainError } = require("./domain-error");

class DailyCloseNotFoundError extends DomainError {
  constructor(date) {
    super("DAILY_CLOSE_NOT_FOUND", `No existe un Cierre del Día generado para la fecha ${date}.`);
    this.date = date;
  }
}

module.exports = { DailyCloseNotFoundError };
