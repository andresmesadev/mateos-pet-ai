const { ReceptionistNotConfiguredError } = require("../errors/receptionist-not-configured.error");

const SPECIALIZATION = "recepcionista";
const FALLBACK_LOG_REASON = "Empleado Digital Recepcionista no disponible (pausado o no configurado)";

/**
 * ProcessIncomingMessageUseCase (Procesar Mensaje Entrante) — Operación, Caso 1
 * (Etapa 2). Único caso de uso propio del contexto Recepcionista IA.
 *
 * Envuelve el motor conversacional existente (`conversationalEngine`, que
 * satisface ConversationalEngineAdapterPort) sin modificarlo. Da auditoría
 * real (Tarea/Decisión/Escalación) a cada mensaje procesado por "Lina".
 *
 * @param {Object} deps
 * @param {Function} deps.getDigitalEmployees — agents.getDigitalEmployees
 * @param {Function} deps.startAgentTask — agents.startAgentTask
 * @param {Function} deps.registerAgentDecision — agents.registerAgentDecision
 * @param {Function} deps.completeAgentTask — agents.completeAgentTask
 * @param {Function} deps.generateEscalation — agents.generateEscalation
 * @param {Function} deps.escalateConversation — communication.escalateConversation
 * @param {new (...args:any[]) => Error} deps.DigitalEmployeeNotActiveErrorClass
 * @param {new (...args:any[]) => Error} deps.ConversationAlreadyEscalatedErrorClass
 * @param {import("../ports/conversational-engine-adapter.port").ConversationalEngineAdapterPort} deps.conversationalEngine
 * @param {Function} [deps.resolveTenantId] — (body) => Promise<string|null>, resolución de tenant previa a iniciar la Tarea
 * @param {{ warn: Function, error: Function }} [deps.logger]
 */
function createProcessIncomingMessageUseCase({
  getDigitalEmployees,
  startAgentTask,
  registerAgentDecision,
  completeAgentTask,
  generateEscalation,
  escalateConversation,
  DigitalEmployeeNotActiveErrorClass,
  ConversationAlreadyEscalatedErrorClass,
  conversationalEngine,
  resolveTenantId,
  logger = console,
}) {
  async function resolveReceptionist(tenantId) {
    const { digitalEmployees } = await getDigitalEmployees({ tenantId });
    const candidates = digitalEmployees.filter((e) => e.specialization === SPECIALIZATION);
    if (candidates.length === 0) {
      throw new ReceptionistNotConfiguredError(tenantId);
    }
    return candidates.find((e) => e.status === "activo") ?? candidates[0];
  }

  function buildDecisionFields(result) {
    const intent = result?.analysis?.intent ?? null;
    const step = result?.session?.step ?? null;
    const escalated = result?.session?.requires_human_attention === true;
    const reasoning = escalated
      ? `Escalamiento humano detectado (intent=${intent ?? "desconocido"})`
      : `intent=${intent ?? "desconocido"}, step=${step ?? "(ninguno)"}`;
    const action = escalated ? "escalar_a_humano" : step ?? "responder";
    return { reasoning, action, escalated };
  }

  return async function execute(body) {
    const tenantId = typeof resolveTenantId === "function" ? await resolveTenantId(body) : null;

    let employee;
    try {
      employee = await resolveReceptionist(tenantId);
    } catch (error) {
      if (error instanceof ReceptionistNotConfiguredError) {
        logger.warn?.(`[Recepcionista IA] ${FALLBACK_LOG_REASON}: ${error.message}`);
        return { received: true, processed: false };
      }
      throw error;
    }

    let task;
    try {
      ({ task } = await startAgentTask({ digitalEmployeeId: employee.id, origin: "whatsapp" }));
    } catch (error) {
      if (error instanceof DigitalEmployeeNotActiveErrorClass) {
        logger.warn?.(`[Recepcionista IA] ${FALLBACK_LOG_REASON}: ${error.message}`);
        return { received: true, processed: false };
      }
      throw error;
    }

    const result = await conversationalEngine.processIncomingMessage(body);

    const { reasoning, action, escalated } = buildDecisionFields(result);
    await registerAgentDecision({
      agentTaskId: task.id,
      input: { userMessage: result?.text ?? null, analysis: result?.analysis ?? null },
      reasoning,
      action,
    });

    if (escalated) {
      if (result?.conversation?.id) {
        try {
          await escalateConversation({ conversationId: result.conversation.id });
        } catch (error) {
          if (!(error instanceof ConversationAlreadyEscalatedErrorClass)) {
            throw error;
          }
          // Idempotente: la conversación ya estaba escalada — no es un fallo del
          // procesamiento de este mensaje (Etapa 3, sección 6).
        }
      }
      await generateEscalation({
        agentTaskId: task.id,
        context: { userMessage: result?.text ?? null, conversationId: result?.conversation?.id ?? null },
      });
    } else {
      await completeAgentTask({
        agentTaskId: task.id,
        result: { reply: result?.reply ?? null, step: result?.session?.step ?? null },
      });
    }

    return result;
  };
}

module.exports = { createProcessIncomingMessageUseCase, SPECIALIZATION };
