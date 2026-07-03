const { DomainError } = require("./domain-error");

// Invariante 2 (Modelo de Dominio, Etapa 1): un Evento de Dominio solo puede
// pertenecer a un Tipo de Evento activo en el Catálogo.
class EventTypeNotActiveError extends DomainError {
  constructor(name) {
    super(`El Tipo de Evento "${name}" no está activo; no puede certificarse un Evento de Dominio contra él.`);
  }
}

module.exports = { EventTypeNotActiveError };
