const { DomainError } = require("./domain-error");

class InvalidAgentDecisionAttributesError extends DomainError {
  constructor(reason) { super(reason); }
}

module.exports = { InvalidAgentDecisionAttributesError };
