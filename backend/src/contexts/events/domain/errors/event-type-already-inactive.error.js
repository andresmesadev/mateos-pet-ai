const { DomainError } = require("./domain-error");

class EventTypeAlreadyInactiveError extends DomainError {
  constructor(name) {
    super(`El Tipo de Evento "${name}" ya está desactivado.`);
  }
}

module.exports = { EventTypeAlreadyInactiveError };
