const { DigitalEmployeeNotFoundError } = require("../../domain/errors");

function createGetAgentTasksUseCase({ digitalEmployeeRepository, agentTaskRepository }) {
  return async function execute({ digitalEmployeeId, tenantId = null }) {
    const employee = await digitalEmployeeRepository.findById(digitalEmployeeId);
    if (!employee || (tenantId && employee.tenantId !== tenantId)) {
      throw new DigitalEmployeeNotFoundError(digitalEmployeeId);
    }
    const tasks = await agentTaskRepository.listByEmployee(digitalEmployeeId);
    return { tasks };
  };
}
module.exports = { createGetAgentTasksUseCase };
