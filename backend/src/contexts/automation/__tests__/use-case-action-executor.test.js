const { UseCaseActionExecutor } = require("../infrastructure/actions/use-case-action-executor");

describe("UseCaseActionExecutor", () => {
  test('"enviar_mensaje" rechaza si el payload del Evento no provee userId/phone', async () => {
    const executor = new UseCaseActionExecutor({ sendMessage: async () => ({ message: {} }), startAgentTask: async () => ({ task: {} }) });
    await expect(
      executor.execute("enviar_mensaje", { content: "hola" }, { appointmentId: "a-1" }, "t-1")
    ).rejects.toThrow(/userId\/phone/);
  });

  test('"enviar_mensaje" invoca sendMessage cuando el payload sí provee userId/phone', async () => {
    let received;
    const sendMessage = async (args) => {
      received = args;
      return { message: { id: "msg-1" } };
    };
    const executor = new UseCaseActionExecutor({ sendMessage, startAgentTask: async () => ({ task: {} }) });

    const result = await executor.execute(
      "enviar_mensaje",
      { content: "Gracias por tu visita" },
      { userId: "user-1", phone: "573000000000" },
      "t-1"
    );

    expect(received).toMatchObject({ tenantId: "t-1", userId: "user-1", phone: "573000000000", content: "Gracias por tu visita", origin: "sistema" });
    expect(result.message.id).toBe("msg-1");
  });

  test('"asignar_tarea_empleado" exige digitalEmployeeId en actionConfig', async () => {
    const executor = new UseCaseActionExecutor({ sendMessage: async () => ({}), startAgentTask: async () => ({ task: {} }) });
    await expect(executor.execute("asignar_tarea_empleado", {}, {}, "t-1")).rejects.toThrow(/digitalEmployeeId/);
  });

  test('"asignar_tarea_empleado" invoca startAgentTask', async () => {
    let received;
    const startAgentTask = async (args) => {
      received = args;
      return { task: { id: "task-1" } };
    };
    const executor = new UseCaseActionExecutor({ sendMessage: async () => ({}), startAgentTask });

    const result = await executor.execute("asignar_tarea_empleado", { digitalEmployeeId: "de-1" }, {}, "t-1");

    expect(received).toMatchObject({ digitalEmployeeId: "de-1", origin: "automatizacion" });
    expect(result.task.id).toBe("task-1");
  });

  test("tipo de acción desconocido lanza error", async () => {
    const executor = new UseCaseActionExecutor({ sendMessage: async () => ({}), startAgentTask: async () => ({}) });
    await expect(executor.execute("no-existe", {}, {}, "t-1")).rejects.toThrow(/desconocido/);
  });
});
