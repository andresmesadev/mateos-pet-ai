const { createGetAgentTasksUseCase } = require("../application/use-cases/get-agent-tasks.usecase");
const { DigitalEmployeeNotFoundError } = require("../domain/errors");

function buildDeps({ employees = [], tasks = [] } = {}) {
  return {
    digitalEmployeeRepository: {
      findById: async (id) => employees.find((e) => e.id === id) ?? null,
    },
    agentTaskRepository: {
      listByEmployee: async (digitalEmployeeId) => tasks.filter((t) => t.digitalEmployeeId === digitalEmployeeId),
    },
  };
}

describe("GetAgentTasksUseCase", () => {
  test("rechaza consultar tareas de un Empleado Digital inexistente", async () => {
    const { digitalEmployeeRepository, agentTaskRepository } = buildDeps();
    const execute = createGetAgentTasksUseCase({ digitalEmployeeRepository, agentTaskRepository });
    await expect(execute({ digitalEmployeeId: "no-existe" })).rejects.toBeInstanceOf(DigitalEmployeeNotFoundError);
  });

  test("lista las tareas de un Empleado Digital del mismo tenant", async () => {
    const { digitalEmployeeRepository, agentTaskRepository } = buildDeps({
      employees: [{ id: "de-1", tenantId: "t1" }],
      tasks: [{ id: "task-1", digitalEmployeeId: "de-1" }],
    });
    const execute = createGetAgentTasksUseCase({ digitalEmployeeRepository, agentTaskRepository });
    const { tasks } = await execute({ digitalEmployeeId: "de-1", tenantId: "t1" });
    expect(tasks).toHaveLength(1);
  });

  test("Entregable 6.5 — rechaza consultar tareas de un Empleado Digital de otro tenant como si no existiera", async () => {
    const { digitalEmployeeRepository, agentTaskRepository } = buildDeps({
      employees: [{ id: "de-1", tenantId: "t2" }],
      tasks: [{ id: "task-1", digitalEmployeeId: "de-1" }],
    });
    const execute = createGetAgentTasksUseCase({ digitalEmployeeRepository, agentTaskRepository });
    await expect(execute({ digitalEmployeeId: "de-1", tenantId: "t1" })).rejects.toBeInstanceOf(DigitalEmployeeNotFoundError);
  });

  test("sin tenantId (uso interno) no filtra por tenant", async () => {
    const { digitalEmployeeRepository, agentTaskRepository } = buildDeps({
      employees: [{ id: "de-1", tenantId: "t2" }],
      tasks: [{ id: "task-1", digitalEmployeeId: "de-1" }],
    });
    const execute = createGetAgentTasksUseCase({ digitalEmployeeRepository, agentTaskRepository });
    const { tasks } = await execute({ digitalEmployeeId: "de-1" });
    expect(tasks).toHaveLength(1);
  });
});
