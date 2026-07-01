const { DomainError } = require("./domain-error");

/**
 * Protección de aplicación del invariante "un Cierre del Día único y activo
 * por tenant y fecha" (finanzas-modelo-persistencia.md, sección 6).
 * Complementada por el índice único en base de datos (finanzas-esquema-fisico.md, sección 3).
 */
class DuplicateDailyCloseError extends DomainError {
  constructor(date) {
    super("DUPLICATE_DAILY_CLOSE", `Ya existe un Cierre del Día generado para la fecha ${date}.`);
    this.date = date;
  }
}

module.exports = { DuplicateDailyCloseError };
