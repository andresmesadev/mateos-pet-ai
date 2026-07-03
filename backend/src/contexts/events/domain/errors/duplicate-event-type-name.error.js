const { DomainError } = require("./domain-error");

class DuplicateEventTypeNameError extends DomainError {
  constructor(name) {
    super(`Ya existe un Tipo de Evento con el nombre "${name}".`);
  }
}

module.exports = { DuplicateEventTypeNameError };
