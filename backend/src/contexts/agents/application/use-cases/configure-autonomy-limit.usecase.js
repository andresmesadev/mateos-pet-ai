const { DigitalEmployeeNotFoundError, InvalidDigitalEmployeeAttributesError } = require("../../domain/errors");

function createConfigureAutonomyLimitUseCase({ digitalEmployeeRepository, eventPublisher }) {
  return async function execute({ digitalEmployeeId, action, autoApproved }) {
    if (!action || !action.trim()) {
      throw new InvalidDigitalEmployeeAttributesError("action es obligatorio.");
    }
    const employee = await digitalEmployeeRepository.findById(digitalEmployeeId);
    if (!employee) throw new DigitalEmployeeNotFoundError(digitalEmployeeId);

    const limit = await digitalEmployeeRepository.setAutonomyLimit(digitalEmployeeId, action.trim(), Boolean(autoApproved));
    await eventPublisher.publish("LimiteDeAutonomiaConfigurado", { digitalEmployeeId, limit, tenantId: employee.tenantId });
    return { limit };
  };
}
module.exports = { createConfigureAutonomyLimitUseCase };
