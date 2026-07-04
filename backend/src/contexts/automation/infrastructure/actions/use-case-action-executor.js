const { ActionExecutorPort } = require("../../application/ports/action-executor.port");

/**
 * Satisface ActionExecutorPort invocando exclusivamente los casos de uso ya
 * expuestos por Comunicación y Empleados Digitales (Etapa 3, sección 2/3) —
 * sin conocer su lógica interna.
 *
 * Decisión de Etapa 3, sección 3 (Alcance real del disparador único): la
 * acción "enviar_mensaje" exige que el payload del Evento de Dominio incluya
 * `userId` y `phone`. Si el disparador no los provee — como es el caso hoy de
 * "CitaCompletada" (payload frozen, ADR 007) — la acción falla de forma
 * explícita y controlada; esto se registra como una limitación del contrato
 * del Evento, nunca se resuelve reconstruyendo el dato consultando otro
 * contexto (instrucción explícita del alcance de este entregable).
 */
class UseCaseActionExecutor extends ActionExecutorPort {
  constructor({ sendMessage, startAgentTask }) {
    super();
    this.sendMessage = sendMessage;
    this.startAgentTask = startAgentTask;
  }

  async execute(actionType, actionConfig, eventPayload, tenantId) {
    if (actionType === "enviar_mensaje") {
      return this.executeEnviarMensaje(actionConfig, eventPayload, tenantId);
    }
    if (actionType === "asignar_tarea_empleado") {
      return this.executeAsignarTareaEmpleado(actionConfig);
    }
    throw new Error(`Tipo de acción desconocido: "${actionType}".`);
  }

  async executeEnviarMensaje(actionConfig, eventPayload, tenantId) {
    if (!eventPayload?.userId || !eventPayload?.phone) {
      throw new Error(
        'Acción "enviar_mensaje": el Evento de Dominio disparador no provee userId/phone — ' +
          "limitación del contrato del Evento, no de la Regla."
      );
    }
    if (!actionConfig?.content || !String(actionConfig.content).trim()) {
      throw new Error('Acción "enviar_mensaje": actionConfig.content es obligatorio.');
    }

    const { message } = await this.sendMessage({
      tenantId,
      userId: eventPayload.userId,
      phone: eventPayload.phone,
      content: actionConfig.content,
      origin: "sistema",
    });
    return { message };
  }

  async executeAsignarTareaEmpleado(actionConfig) {
    if (!actionConfig?.digitalEmployeeId) {
      throw new Error('Acción "asignar_tarea_empleado": actionConfig.digitalEmployeeId es obligatorio.');
    }

    const { task } = await this.startAgentTask({
      digitalEmployeeId: actionConfig.digitalEmployeeId,
      origin: actionConfig.origin ?? "automatizacion",
    });
    return { task };
  }
}

module.exports = { UseCaseActionExecutor };
