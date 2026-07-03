const { DomainError } = require("./domain-error");

class EventTypeNotFoundError extends DomainError {
  constructor(identifier) {
    super(`El Tipo de Evento "${identifier}" no existe en el Catálogo.`);
  }
}

module.exports = { EventTypeNotFoundError };
