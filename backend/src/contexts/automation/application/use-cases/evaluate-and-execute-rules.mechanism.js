const { matchesCondition } = require("../../domain/rules/condition-evaluation.rules");

/**
 * evaluateAndExecuteRules — operación de infraestructura reactiva, NO un caso
 * de uso invocable por HTTP (Caso 5, Etapa 2: "sin invocador HTTP", mismo
 * estatus que los mecanismos de Entrega de Evento de 3.0).
 *
 * Invariante crítica (Etapa 3, Decisión 4): esta función NUNCA relanza una
 * excepción. Es el suscriptor del dispatcher del Puente para el disparador
 * certificado — un fallo aquí no puede hacer rollback del comando que originó
 * el Evento de Dominio (p. ej. Completar Cita). Cada Regla se evalúa y
 * ejecuta en su propio try/catch; el fallo de una no afecta a las demás.
 *
 * Al terminar de evaluar todas las Reglas para el Evento, certifica exactamente
 * una Entrega de Evento para el consumidor "Automatizaciones" (Etapa 1,
 * Decisión 6) — "delivered" si el motor de evaluación no colapsó, "failed" en
 * el caso excepcional de que sí lo haya hecho.
 *
 * Entregable 5.1 — Outbox de Eventos de Dominio: esta misma función es
 * reutilizada, sin cambios de firma, por el job de reintento
 * (jobs/event-delivery-retry.job.js) para reintentar una entrega "failed" —
 * es idempotente por Regla (ver comentario junto a `hasSuccessfulExecution`),
 * por lo que reintentar no duplica efectos secundarios ya ejecutados con éxito.
 *
 * @param {Object} deps
 * @param {import("../ports/automation-rule-repository.port").AutomationRuleRepositoryPort} deps.automationRuleRepository
 * @param {import("../ports/automation-execution-repository.port").AutomationExecutionRepositoryPort} deps.automationExecutionRepository
 * @param {import("../ports/action-executor.port").ActionExecutorPort} deps.actionExecutor
 * @param {import("../ports/event-delivery.port").EventDeliveryPort} deps.eventDelivery
 * @param {{ error: Function }} [deps.logger]
 */
function createEvaluateAndExecuteRulesMechanism({
  automationRuleRepository,
  automationExecutionRepository,
  actionExecutor,
  eventDelivery,
  logger = console,
}) {
  const CONSUMER = "Automatizaciones";

  return async function evaluateAndExecuteRules({ domainEvent, eventPayload }, ctx) {
    if (!domainEvent?.id) return;

    try {
      const rules = await automationRuleRepository.listActiveByTrigger(
        domainEvent.tenantId,
        domainEvent.eventTypeId,
        ctx
      );

      for (const rule of rules) {
        if (!matchesCondition(rule.condition, eventPayload)) continue;

        // Entregable 5.1 — Outbox de Eventos de Dominio: idempotencia del
        // reintento. Si esta Regla ya tuvo éxito para este Evento (un
        // reintento previo, o una ejecución parcial anterior a un colapso
        // del evaluador), no se re-ejecuta su acción — evita duplicar
        // efectos secundarios (p. ej. reenviar un mensaje ya enviado).
        const alreadySucceeded = await automationExecutionRepository.hasSuccessfulExecution(rule.id, domainEvent.id);
        if (alreadySucceeded) continue;

        try {
          const result = await actionExecutor.execute(rule.actionType, rule.actionConfig, eventPayload, domainEvent.tenantId);
          await automationExecutionRepository.create(
            {
              automationRuleId: rule.id,
              domainEventId: domainEvent.id,
              status: "success",
              actionResult: result ?? null,
              failureReason: null,
            },
            ctx
          );
        } catch (actionError) {
          await automationExecutionRepository.create(
            {
              automationRuleId: rule.id,
              domainEventId: domainEvent.id,
              status: "failed",
              actionResult: null,
              failureReason: actionError.message,
            },
            ctx
          );
        }
      }

      await eventDelivery.register({ domainEventId: domainEvent.id, consumer: CONSUMER, status: "delivered" });
    } catch (error) {
      logger.error?.("[Automatizaciones] Fallo al evaluar Reglas para el Evento de Dominio", {
        domainEventId: domainEvent.id,
        error: error.message,
      });
      try {
        await eventDelivery.register({
          domainEventId: domainEvent.id,
          consumer: CONSUMER,
          status: "failed",
          failureReason: error.message,
        });
      } catch (_deliveryError) {
        // Nunca propagar — este mecanismo no puede afectar al comando disparador.
      }
    }
  };
}

module.exports = { createEvaluateAndExecuteRulesMechanism };
