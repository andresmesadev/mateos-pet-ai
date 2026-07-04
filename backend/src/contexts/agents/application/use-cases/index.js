const { createRegisterDigitalEmployeeUseCase } = require("./register-digital-employee.usecase");
const { createPauseDigitalEmployeeUseCase } = require("./pause-digital-employee.usecase");
const { createReactivateDigitalEmployeeUseCase } = require("./reactivate-digital-employee.usecase");
const { createConfigureAutonomyLimitUseCase } = require("./configure-autonomy-limit.usecase");
const { createStartAgentTaskUseCase } = require("./start-agent-task.usecase");
const { createRegisterAgentDecisionUseCase } = require("./register-agent-decision.usecase");
const { createCompleteAgentTaskUseCase } = require("./complete-agent-task.usecase");
const { createGenerateEscalationUseCase } = require("./generate-escalation.usecase");
const { createAttendEscalationUseCase } = require("./attend-escalation.usecase");
const { createGetDigitalEmployeesUseCase } = require("./get-digital-employees.usecase");
const { createGetAgentTasksUseCase } = require("./get-agent-tasks.usecase");
const { createGetAgentDecisionsUseCase } = require("./get-agent-decisions.usecase");
const { createGetPendingEscalationsUseCase } = require("./get-pending-escalations.usecase");

module.exports = {
  createRegisterDigitalEmployeeUseCase,
  createPauseDigitalEmployeeUseCase,
  createReactivateDigitalEmployeeUseCase,
  createConfigureAutonomyLimitUseCase,
  createStartAgentTaskUseCase,
  createRegisterAgentDecisionUseCase,
  createCompleteAgentTaskUseCase,
  createGenerateEscalationUseCase,
  createAttendEscalationUseCase,
  createGetDigitalEmployeesUseCase,
  createGetAgentTasksUseCase,
  createGetAgentDecisionsUseCase,
  createGetPendingEscalationsUseCase,
};
