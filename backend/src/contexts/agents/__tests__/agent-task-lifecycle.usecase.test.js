const { createStartAgentTaskUseCase } = require("../application/use-cases/start-agent-task.usecase");
const { createRegisterAgentDecisionUseCase } = require("../application/use-cases/register-agent-decision.usecase");
const { createCompleteAgentTaskUseCase } = require("../application/use-cases/complete-agent-task.usecase");
const { createGenerateEscalationUseCase } = require("../application/use-cases/generate-escalation.usecase");
const {
  DigitalEmployeeNotActiveError,
  AgentTaskAlreadyClosedError,
  InvalidAgentDecisionAttributesError,
} = require("../domain/errors");

const eventPublisher = { publish: async () => {} };

function buildContext({ employeeStatus = "activo" } = {}) {
  const employees = [{ id: "de-1", status: employeeStatus }];
  const tasks = [];
  const decisions = [];
  const escalations = [];

  const digitalEmployeeRepository = { findById: async (id) => employees.find((e) => e.id === id) ?? null };
  const agentTaskRepository = {
    create: async (data) => {
      const row = { id: `task-${tasks.length + 1}`, ...data };
      tasks.push(row);
      return row;
    },
    findById: async (id) => tasks.find((t) => t.id === id) ?? null,
    complete: async (id, result) => {
      const t = tasks.find((r) => r.id === id);
      t.status = "completada";
      t.result = result;
      return t;
    },
    escalate: async (id) => {
      const t = tasks.find((r) => r.id === id);
      t.status = "escalada";
      return t;
    },
  };
  const agentDecisionRepository = {
    create: async (data) => {
      const row = { id: `dec-${decisions.length + 1}`, ...data };
      decisions.push(row);
      return row;
    },
  };
  const escalationRepository = {
    create: async (data) => {
      const row = { id: `esc-${escalations.length + 1}`, ...data };
      escalations.push(row);
      return row;
    },
  };

  return { digitalEmployeeRepository, agentTaskRepository, agentDecisionRepository, escalationRepository, tasks };
}

describe("StartAgentTaskUseCase", () => {
  test("rechaza iniciar tarea si el Empleado Digital no está activo", async () => {
    const ctx = buildContext({ employeeStatus: "pausado" });
    const execute = createStartAgentTaskUseCase({ ...ctx, eventPublisher });
    await expect(execute({ digitalEmployeeId: "de-1", origin: "webhook" })).rejects.toBeInstanceOf(
      DigitalEmployeeNotActiveError
    );
  });
});

describe("RegisterAgentDecisionUseCase", () => {
  test("rechaza registrar decisión sobre una tarea ya cerrada", async () => {
    const ctx = buildContext();
    const start = createStartAgentTaskUseCase({ ...ctx, eventPublisher });
    const complete = createCompleteAgentTaskUseCase({ ...ctx, eventPublisher });
    const registerDecision = createRegisterAgentDecisionUseCase({ ...ctx, eventPublisher });

    const { task } = await start({ digitalEmployeeId: "de-1", origin: "webhook" });
    await complete({ agentTaskId: task.id });

    await expect(
      registerDecision({ agentTaskId: task.id, input: {}, reasoning: "r", action: "a" })
    ).rejects.toBeInstanceOf(AgentTaskAlreadyClosedError);
  });

  test("rechaza reasoning/action vacíos", async () => {
    const ctx = buildContext();
    const start = createStartAgentTaskUseCase({ ...ctx, eventPublisher });
    const registerDecision = createRegisterAgentDecisionUseCase({ ...ctx, eventPublisher });
    const { task } = await start({ digitalEmployeeId: "de-1", origin: "webhook" });

    await expect(
      registerDecision({ agentTaskId: task.id, input: {}, reasoning: "", action: "a" })
    ).rejects.toBeInstanceOf(InvalidAgentDecisionAttributesError);
  });
});

describe("GenerateEscalationUseCase", () => {
  test("escalar una tarea la deja en estado 'escalada' y produce Escalación pendiente", async () => {
    const ctx = buildContext();
    const start = createStartAgentTaskUseCase({ ...ctx, eventPublisher });
    const generateEscalation = createGenerateEscalationUseCase({ ...ctx, eventPublisher });

    const { task } = await start({ digitalEmployeeId: "de-1", origin: "webhook" });
    const { escalation } = await generateEscalation({ agentTaskId: task.id, context: { motivo: "no_resuelto" } });

    expect(escalation.status).toBe("pendiente");
    expect(ctx.tasks.find((t) => t.id === task.id).status).toBe("escalada");
  });

  test("rechaza escalar una tarea ya cerrada", async () => {
    const ctx = buildContext();
    const start = createStartAgentTaskUseCase({ ...ctx, eventPublisher });
    const complete = createCompleteAgentTaskUseCase({ ...ctx, eventPublisher });
    const generateEscalation = createGenerateEscalationUseCase({ ...ctx, eventPublisher });

    const { task } = await start({ digitalEmployeeId: "de-1", origin: "webhook" });
    await complete({ agentTaskId: task.id });

    await expect(
      generateEscalation({ agentTaskId: task.id, context: {} })
    ).rejects.toBeInstanceOf(AgentTaskAlreadyClosedError);
  });
});
