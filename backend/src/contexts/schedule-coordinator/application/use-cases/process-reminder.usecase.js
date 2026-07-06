const REMINDER_TYPE_METHODS = {
  appointment: "sendAndMarkAppointmentReminder",
  vaccine: "sendAndMarkVaccineReminder",
  deworming: "sendAndMarkDewormingReminder",
  grooming: "sendAndMarkGroomingReminder",
  follow_up: "sendAndMarkFollowUp",
};

/**
 * ProcessReminderUseCase (Procesar Recordatorio) — Operación, Caso 1 (Etapa 2).
 * Único caso de uso propio del contexto Coordinador de Agenda IA.
 *
 * Envuelve el motor de recordatorios existente (`reminderEngine`, que
 * satisface ReminderEngineAdapterPort) sin modificarlo. Da auditoría real
 * (Tarea/Decisión) a cada intento de recordatorio — sin rama de
 * escalamiento (Etapa 1, Decisión 5: un recordatorio fallido no requiere
 * intervención humana).
 *
 * @param {Object} deps
 * @param {Function} deps.startAgentTask — agents.startAgentTask
 * @param {Function} deps.registerAgentDecision — agents.registerAgentDecision
 * @param {Function} deps.completeAgentTask — agents.completeAgentTask
 * @param {import("../ports/reminder-engine-adapter.port").ReminderEngineAdapterPort} deps.reminderEngine
 * @param {{ error: Function }} [deps.logger]
 */
function createProcessReminderUseCase({
  startAgentTask,
  registerAgentDecision,
  completeAgentTask,
  reminderEngine,
  logger = console,
}) {
  return async function execute({ digitalEmployeeId, reminderType, entity }) {
    const method = REMINDER_TYPE_METHODS[reminderType];
    if (!method) {
      throw new Error(`Tipo de recordatorio desconocido: "${reminderType}".`);
    }

    const { task } = await startAgentTask({ digitalEmployeeId, origin: "cron_reminder_job" });

    let sent = false;
    let failureReason = null;
    try {
      sent = await reminderEngine[method](entity);
    } catch (error) {
      failureReason = error.message;
      logger.error?.(`[Coordinador de Agenda IA] Error procesando recordatorio "${reminderType}":`, error.message);
    }

    const reasoning = failureReason
      ? `Error al procesar recordatorio: ${failureReason}`
      : sent
      ? `Recordatorio "${reminderType}" enviado`
      : `Recordatorio "${reminderType}" omitido (datos insuficientes o envío no confirmado)`;
    const action = failureReason ? "reminder_failed" : sent ? "reminder_sent" : "reminder_skipped";

    await registerAgentDecision({
      agentTaskId: task.id,
      input: { reminderType, entityId: entity?.id ?? null },
      reasoning,
      action,
    });

    await completeAgentTask({
      agentTaskId: task.id,
      result: { sent, failureReason },
    });

    return { sent };
  };
}

module.exports = { createProcessReminderUseCase, REMINDER_TYPE_METHODS };
