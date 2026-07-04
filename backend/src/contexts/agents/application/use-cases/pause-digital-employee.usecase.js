const { DigitalEmployeeNotFoundError, DigitalEmployeeAlreadyPausedError } = require("../../domain/errors");

function createPauseDigitalEmployeeUseCase({ digitalEmployeeRepository, eventPublisher }) {
  return async function execute({ digitalEmployeeId }) {
    const employee = await digitalEmployeeRepository.findById(digitalEmployeeId);
    if (!employee) throw new DigitalEmployeeNotFoundError(digitalEmployeeId);
    if (employee.status === "pausado") throw new DigitalEmployeeAlreadyPausedError(digitalEmployeeId);
    const paused = await digitalEmployeeRepository.pause(digitalEmployeeId);
    await eventPublisher.publish("EmpleadoDigitalPausado", { digitalEmployee: paused });
    return { digitalEmployee: paused };
  };
}
module.exports = { createPauseDigitalEmployeeUseCase };
