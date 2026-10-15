const { DigitalEmployeeNotFoundError, DigitalEmployeeNotActiveError, InvalidAgentTaskAttributesError } = require("../../domain/errors");

/**
 * StartAgentTaskUseCase (Iniciar Tarea) — Operación (reactivo). Caso 5 (Etapa 2).
 * Sin invocador real en este entregable (mismo estatus que Eventos 3.0).
 */
function createStartAgentTaskUseCase({ digitalEmployeeRepository, agentTaskRepository, eventPublisher }) {
  return async function execute({ digitalEmployeeId, origin }, ctx) {
    if (!origin || !origin.trim()) {
      throw new InvalidAgentTaskAttributesError("origin es obligatorio.");
    }
    const employee = await digitalEmployeeRepository.findById(digitalEmployeeId, ctx);
    if (!employee) throw new DigitalEmployeeNotFoundError(digitalEmployeeId);
    if (employee.status !== "activo") throw new DigitalEmployeeNotActiveError(digitalEmployeeId);

    const task = await agentTaskRepository.create({
      digitalEmployeeId,
      origin: origin.trim(),
      status: "en_proceso",
    }, ctx);
    await (ctx?.eventPublisher ?? eventPublisher).publish("TareaIniciada", { task, tenantId: employee.tenantId });
    return { task };
  };
}
module.exports = { createStartAgentTaskUseCase };
