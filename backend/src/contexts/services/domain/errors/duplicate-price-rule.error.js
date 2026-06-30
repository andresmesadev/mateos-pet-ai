const { DomainError } = require("./domain-error");

/**
 * Protección de aplicación del invariante "no pueden coexistir dos reglas de
 * precio activas para el mismo destino" (servicios-modelo-persistencia.md, sección 6).
 * Complementada por el índice único parcial en base de datos
 * (servicios-esquema-fisico.md, sección 3 — Principio Permanente del Esquema Físico).
 */
class DuplicatePriceRuleError extends DomainError {
  constructor(serviceId, targetType, targetId) {
    super(
      "DUPLICATE_PRICE_RULE",
      `Ya existe una regla de precio activa para el servicio "${serviceId}" con destino ${targetType}:"${targetId}".`
    );
    this.serviceId = serviceId;
    this.targetType = targetType;
    this.targetId = targetId;
  }
}

module.exports = { DuplicatePriceRuleError };
