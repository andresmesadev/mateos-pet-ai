const { DomainError } = require("./domain-error");

class InvalidAgentTaskAttributesError extends DomainError {
  constructor(reason) { super(reason); }
}
class AgentTaskNotFoundError extends DomainError {
  constructor(id) { super(`La Tarea del Agente "${id}" no existe.`); }
}
class AgentTaskAlreadyClosedError extends DomainError {
  constructor(id, status) { super(`La Tarea del Agente "${id}" ya está "${status}"; no admite nuevas decisiones ni cierres.`); }
}

module.exports = { InvalidAgentTaskAttributesError, AgentTaskNotFoundError, AgentTaskAlreadyClosedError };
