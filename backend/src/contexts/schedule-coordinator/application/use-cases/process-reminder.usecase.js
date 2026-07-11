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
 * Entregable 5.3 — Aplicación Real de Límite de Autonomía: antes de invocar
 * `reminderEngine[method]`, consulta `AgentAutonomyLimit` para
 * `(digitalEmployeeId, reminderType)`. Invariante no negociable: la AUSENCIA
 * de configuración nunca bloquea una acción — solo un límite explícitamente
 * configurado con `autoApproved === false` bloquea el envío automático y
 * genera una Escalación en su lugar, reutilizando el mecanismo ya existente
 * (3.2) sin ninguna modificación.
 *
 * @param {Object} deps
 * @param {Function} deps.startAgentTask — agents.startAgentTask
 * @param {Function} deps.registerAgentDecision — agents.registerAgentDecision
 * @param {Function} deps.completeAgentTask — agents.completeAgentTask
 * @param {Function} deps.getAutonomyLimit — agents.getAutonomyLimit
 * @param {Function} deps.generateEscalation — agents.generateEscalation
 * @param {import("../ports/reminder-engine-adapter.port").ReminderEngineAdapterPort} deps.reminderEngine
 * @param {{ error: Function }} [deps.logger]
 */
function createProcessReminderUseCase({
  startAgentTask,
  registerAgentDecision,
  completeAgentTask,
  getAutonomyLimit,
  generateEscalation,
  reminderEngine,
  logger = console,
}) {
  return async function execute({ digitalEmployeeId, reminderType, entity }) {
    const method = REMINDER_TYPE_METHODS[reminderType];
    if (!method) {
      throw new Error(`Tipo de recordatorio desconocido: "${reminderType}".`);
    }

    const { task } = await startAgentTask({ digitalEmployeeId, origin: "cron_reminder_job" });

    // Entregable 5.3 — Aplicación Real de Límite de Autonomía.
    //
    //   NO EXISTE CONFIGURACIÓN → AUTOAPROBADO → se envía el recordatorio
    //   normalmente (comportamiento idéntico al existente antes de este
    //   entregable). Solo un límite explícito con autoApproved === false
    //   bloquea el envío.
    const autonomyLimit = await getAutonomyLimit(digitalEmployeeId, reminderType);
    const blockedByAutonomyLimit = autonomyLimit != null && autonomyLimit.autoApproved === false;

    if (blockedByAutonomyLimit) {
      await registerAgentDecision({
        agentTaskId: task.id,
        input: { reminderType, entityId: entity?.id ?? null },
        reasoning: `Recordatorio "${reminderType}" bloqueado por Límite de Autonomía (autoApproved=false) — requiere confirmación humana`,
        action: "reminder_escalated",
      });
      await generateEscalation({
        agentTaskId: task.id,
        context: { reminderType, entityId: entity?.id ?? null, reason: "autonomy_limit_not_approved" },
      });
      return { sent: false, escalated: true };
    }

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
