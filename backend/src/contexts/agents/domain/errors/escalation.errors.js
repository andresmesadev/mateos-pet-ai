const { DomainError } = require("./domain-error");

class InvalidEscalationAttributesError extends DomainError {
  constructor(reason) { super(reason); }
}
class EscalationNotFoundError extends DomainError {
  constructor(id) { super(`La Escalación "${id}" no existe.`); }
}
class EscalationAlreadyResolvedError extends DomainError {
  constructor(id) { super(`La Escalación "${id}" ya fue atendida.`); }
}

module.exports = { InvalidEscalationAttributesError, EscalationNotFoundError, EscalationAlreadyResolvedError };
