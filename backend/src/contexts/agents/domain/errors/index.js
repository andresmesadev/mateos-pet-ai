const { DomainError } = require("./domain-error");
const {
  InvalidDigitalEmployeeAttributesError,
  DigitalEmployeeNotFoundError,
  DigitalEmployeeNotActiveError,
  DigitalEmployeeAlreadyPausedError,
  DigitalEmployeeAlreadyActiveError,
} = require("./digital-employee.errors");
const {
  InvalidAgentTaskAttributesError,
  AgentTaskNotFoundError,
  AgentTaskAlreadyClosedError,
} = require("./agent-task.errors");
const { InvalidAgentDecisionAttributesError } = require("./agent-decision.errors");
const {
  InvalidEscalationAttributesError,
  EscalationNotFoundError,
  EscalationAlreadyResolvedError,
} = require("./escalation.errors");

module.exports = {
  DomainError,
  InvalidDigitalEmployeeAttributesError,
  DigitalEmployeeNotFoundError,
  DigitalEmployeeNotActiveError,
  DigitalEmployeeAlreadyPausedError,
  DigitalEmployeeAlreadyActiveError,
  InvalidAgentTaskAttributesError,
  AgentTaskNotFoundError,
  AgentTaskAlreadyClosedError,
  InvalidAgentDecisionAttributesError,
  InvalidEscalationAttributesError,
  EscalationNotFoundError,
  EscalationAlreadyResolvedError,
};
