const { DomainError } = require("./domain-error");

class DomainEventNotFoundError extends DomainError {
  constructor(id) {
    super(`El Evento de Dominio "${id}" no existe.`);
  }
}

module.exports = { DomainEventNotFoundError };
