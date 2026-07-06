const { createProcessIncomingMessageUseCase } = require("../application/use-cases/process-incoming-message.usecase");
const { ReceptionistNotConfiguredError } = require("../application/errors/receptionist-not-configured.error");

class DigitalEmployeeNotActiveErrorClass extends Error {}
class ConversationAlreadyEscalatedErrorClass extends Error {}

function buildDeps({
  employees = [{ id: "de-1", specialization: "recepcionista", status: "activo" }],
  startAgentTaskImpl,
  engineResult = { processed: true, reply: "hola", text: "hola", conversation: { id: "conv-1" }, session: { step: null } },
} = {}) {
  const decisions = [];
  const completedTasks = [];
  const escalations = [];
  const escalatedConversations = [];

  const getDigitalEmployees = async () => ({ digitalEmployees: employees });
  const startAgentTask =
    startAgentTaskImpl ?? (async () => ({ task: { id: "task-1", status: "en_proceso" } }));
  const registerAgentDecision = async (data) => {
    decisions.push(data);
    return { decision: { id: "dec-1", ...data } };
  };
  const completeAgentTask = async (data) => {
    completedTasks.push(data);
    return { task: { id: data.agentTaskId, status: "completada" } };
  };
  const generateEscalation = async (data) => {
    escalations.push(data);
    return { escalation: { id: "esc-1", ...data } };
  };
  const escalateConversation = async (data) => {
    escalatedConversations.push(data);
    return { conversation: { id: data.conversationId, status: "esperando_humano" } };
  };
  const conversationalEngine = { processIncomingMessage: async () => engineResult };

  return {
    getDigitalEmployees,
    startAgentTask,
    registerAgentDecision,
    completeAgentTask,
    generateEscalation,
    escalateConversation,
    DigitalEmployeeNotActiveErrorClass,
    ConversationAlreadyEscalatedErrorClass,
    conversationalEngine,
    resolveTenantId: async () => "tenant-1",
    logger: { warn: () => {}, error: () => {} },
    decisions,
    completedTasks,
    escalations,
    escalatedConversations,
  };
}

describe("ProcessIncomingMessageUseCase", () => {
  test("sin Recepcionista configurada: no invoca el motor y responde processed:false", async () => {
    const deps = buildDeps({ employees: [] });
    const execute = createProcessIncomingMessageUseCase(deps);
    const engineSpy = jest.spyOn(deps.conversationalEngine, "processIncomingMessage");

    const result = await execute({});

    expect(result).toEqual({ received: true, processed: false });
    expect(engineSpy).not.toHaveBeenCalled();
  });

  test("Recepcionista pausada: no invoca el motor y responde processed:false", async () => {
    const deps = buildDeps({
      startAgentTaskImpl: async () => {
        throw new DigitalEmployeeNotActiveErrorClass("pausada");
      },
    });
    const execute = createProcessIncomingMessageUseCase(deps);
    const engineSpy = jest.spyOn(deps.conversationalEngine, "processIncomingMessage");

    const result = await execute({});

    expect(result).toEqual({ received: true, processed: false });
    expect(engineSpy).not.toHaveBeenCalled();
  });

  test("camino normal: inicia Tarea, delega en el motor, registra Decisión y completa la Tarea", async () => {
    const deps = buildDeps();
    const execute = createProcessIncomingMessageUseCase(deps);

    const result = await execute({});

    expect(result.reply).toBe("hola");
    expect(deps.decisions).toHaveLength(1);
    expect(deps.completedTasks).toHaveLength(1);
    expect(deps.escalations).toHaveLength(0);
    expect(deps.escalatedConversations).toHaveLength(0);
  });

  test("escalamiento: genera Escalación y escala la Conversación, sin completar la Tarea", async () => {
    const deps = buildDeps({
      engineResult: {
        processed: true,
        reply: "Te comunico con Lina",
        text: "quiero hablar con una persona",
        conversation: { id: "conv-2" },
        session: { step: "human_takeover", requires_human_attention: true },
      },
    });
    const execute = createProcessIncomingMessageUseCase(deps);

    await execute({});

    expect(deps.escalatedConversations).toEqual([{ conversationId: "conv-2" }]);
    expect(deps.escalations).toHaveLength(1);
    expect(deps.completedTasks).toHaveLength(0);
  });

  test("escalamiento sobre conversación ya escalada: idempotente, no falla el procesamiento", async () => {
    const deps = buildDeps({
      engineResult: {
        processed: true,
        reply: "Te comunico con Lina",
        text: "urgente",
        conversation: { id: "conv-3" },
        session: { step: "human_takeover", requires_human_attention: true },
      },
    });
    deps.escalateConversation = async () => {
      throw new ConversationAlreadyEscalatedErrorClass("ya escalada");
    };
    const execute = createProcessIncomingMessageUseCase(deps);

    await expect(execute({})).resolves.toBeDefined();
    expect(deps.escalations).toHaveLength(1);
  });

  test("propaga errores inesperados de startAgentTask distintos de DigitalEmployeeNotActiveError", async () => {
    const deps = buildDeps({
      startAgentTaskImpl: async () => {
        throw new Error("fallo de infraestructura");
      },
    });
    const execute = createProcessIncomingMessageUseCase(deps);

    await expect(execute({})).rejects.toThrow("fallo de infraestructura");
  });
});

describe("ReceptionistNotConfiguredError", () => {
  test("incluye el tenantId en el mensaje", () => {
    const error = new ReceptionistNotConfiguredError("tenant-x");
    expect(error.message).toMatch(/tenant-x/);
  });
});
