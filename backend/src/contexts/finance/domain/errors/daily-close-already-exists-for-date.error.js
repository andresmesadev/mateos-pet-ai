const { DomainError } = require("./domain-error");

/**
 * Un Gasto no puede registrarse ni anularse para una fecha que ya tenga un
 * Cierre del Día oficial — el cierre es inmutable y un hecho nuevo lo
 * invalidaría retroactivamente (sistema-operativo-finanzas.md, caso de uso 1 y 2).
 */
class DailyCloseAlreadyExistsForDateError extends DomainError {
  constructor(date) {
    super(
      "DAILY_CLOSE_ALREADY_EXISTS_FOR_DATE",
      `Ya existe un Cierre del Día oficial para la fecha ${date}; no se pueden registrar ni anular gastos de ese día.`
    );
    this.date = date;
  }
}

module.exports = { DailyCloseAlreadyExistsForDateError };
