const { createGetAgentDecisionsUseCase } = require("../application/use-cases/get-agent-decisions.usecase");
const { AgentTaskNotFoundError } = require("../domain/errors");

function buildDeps({ tasks = [], decisions = [] } = {}) {
  return {
    agentTaskRepository: {
      findById: async (id) => tasks.find((t) => t.id === id) ?? null,
    },
    agentDecisionRepository: {
      listByTask: async (agentTaskId) => decisions.filter((d) => d.agentTaskId === agentTaskId),
    },
  };
}

describe("GetAgentDecisionsUseCase", () => {
  test("rechaza consultar decisiones de una Tarea inexistente", async () => {
    const { agentTaskRepository, agentDecisionRepository } = buildDeps();
    const execute = createGetAgentDecisionsUseCase({ agentTaskRepository, agentDecisionRepository });
    await expect(execute({ agentTaskId: "no-existe" })).rejects.toBeInstanceOf(AgentTaskNotFoundError);
  });

  test("lista las decisiones de una Tarea del mismo tenant (verificada vía join digitalEmployee.tenantId)", async () => {
    const { agentTaskRepository, agentDecisionRepository } = buildDeps({
      tasks: [{ id: "task-1", digitalEmployee: { tenantId: "t1" } }],
      decisions: [{ id: "dec-1", agentTaskId: "task-1" }],
    });
    const execute = createGetAgentDecisionsUseCase({ agentTaskRepository, agentDecisionRepository });
    const { decisions } = await execute({ agentTaskId: "task-1", tenantId: "t1" });
    expect(decisions).toHaveLength(1);
  });

  test("Entregable 6.5 — rechaza consultar decisiones de una Tarea de otro tenant como si no existiera", async () => {
    const { agentTaskRepository, agentDecisionRepository } = buildDeps({
      tasks: [{ id: "task-1", digitalEmployee: { tenantId: "t2" } }],
      decisions: [{ id: "dec-1", agentTaskId: "task-1" }],
    });
    const execute = createGetAgentDecisionsUseCase({ agentTaskRepository, agentDecisionRepository });
    await expect(execute({ agentTaskId: "task-1", tenantId: "t1" })).rejects.toBeInstanceOf(AgentTaskNotFoundError);
  });

  test("sin tenantId (uso interno) no filtra por tenant", async () => {
    const { agentTaskRepository, agentDecisionRepository } = buildDeps({
      tasks: [{ id: "task-1", digitalEmployee: { tenantId: "t2" } }],
      decisions: [{ id: "dec-1", agentTaskId: "task-1" }],
    });
    const execute = createGetAgentDecisionsUseCase({ agentTaskRepository, agentDecisionRepository });
    const { decisions } = await execute({ agentTaskId: "task-1" });
    expect(decisions).toHaveLength(1);
  });
});
