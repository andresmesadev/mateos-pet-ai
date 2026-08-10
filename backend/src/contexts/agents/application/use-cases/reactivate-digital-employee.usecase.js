const { DigitalEmployeeNotFoundError, DigitalEmployeeAlreadyActiveError } = require("../../domain/errors");

function createReactivateDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher }) {
  return async function execute({ digitalEmployeeId, tenantId = null }) {
    const employee = await digitalEmployeeRepository.findById(digitalEmployeeId);
    if (!employee || (tenantId && employee.tenantId !== tenantId)) {
      throw new DigitalEmployeeNotFoundError(digitalEmployeeId);
    }
    if (employee.status === "activo") throw new DigitalEmployeeAlreadyActiveError(digitalEmployeeId);
    const reactivated = await digitalEmployeeRepository.reactivate(digitalEmployeeId);
    await eventPublisher.publish("EmpleadoDigitalReactivado", { digitalEmployee: reactivated });
    return { digitalEmployee: reactivated };
  };
}
module.exports = { createReactivateDigitalEmployeeUseCase };
