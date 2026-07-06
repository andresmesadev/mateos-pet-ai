const { createProcessReminderUseCase } = require("../application/use-cases/process-reminder.usecase");

function buildDeps({ reminderEngineImpl } = {}) {
  const decisions = [];
  const completedTasks = [];

  const startAgentTask = async () => ({ task: { id: "task-1", status: "en_proceso" } });
  const registerAgentDecision = async (data) => {
    decisions.push(data);
    return { decision: { id: "dec-1", ...data } };
  };
  const completeAgentTask = async (data) => {
    completedTasks.push(data);
    return { task: { id: data.agentTaskId, status: "completada" } };
  };

  const reminderEngine =
    reminderEngineImpl ??
    {
      sendAndMarkAppointmentReminder: async () => true,
      sendAndMarkVaccineReminder: async () => false,
      sendAndMarkDewormingReminder: async () => true,
      sendAndMarkGroomingReminder: async () => true,
      sendAndMarkFollowUp: async () => false,
    };

  return {
    startAgentTask,
    registerAgentDecision,
    completeAgentTask,
    reminderEngine,
    logger: { error: () => {} },
    decisions,
    completedTasks,
  };
}

describe("ProcessReminderUseCase", () => {
  test("rechaza un reminderType desconocido", async () => {
    const deps = buildDeps();
    const execute = createProcessReminderUseCase(deps);
    await expect(
      execute({ digitalEmployeeId: "de-1", reminderType: "no-existe", entity: { id: "x" } })
    ).rejects.toThrow(/desconocido/);
  });

  test("recordatorio enviado: registra Decisión 'reminder_sent' y completa la Tarea con sent:true", async () => {
    const deps = buildDeps();
    const execute = createProcessReminderUseCase(deps);

    const result = await execute({ digitalEmployeeId: "de-1", reminderType: "appointment", entity: { id: "appt-1" } });

    expect(result.sent).toBe(true);
    expect(deps.decisions[0].action).toBe("reminder_sent");
    expect(deps.completedTasks[0].result.sent).toBe(true);
  });

  test("recordatorio omitido (sent:false sin error): registra Decisión 'reminder_skipped'", async () => {
    const deps = buildDeps();
    const execute = createProcessReminderUseCase(deps);

    const result = await execute({ digitalEmployeeId: "de-1", reminderType: "vaccine", entity: { id: "rec-1" } });

    expect(result.sent).toBe(false);
    expect(deps.decisions[0].action).toBe("reminder_skipped");
    expect(deps.completedTasks[0].result.failureReason).toBeNull();
  });

  test("fallo inesperado del motor: nunca se propaga, se registra 'reminder_failed' y se completa la Tarea", async () => {
    const deps = buildDeps({
      reminderEngineImpl: {
        sendAndMarkFollowUp: async () => {
          throw new Error("proveedor caído");
        },
      },
    });
    const execute = createProcessReminderUseCase(deps);

    const result = await execute({ digitalEmployeeId: "de-1", reminderType: "follow_up", entity: { id: "appt-2" } });

    expect(result.sent).toBe(false);
    expect(deps.decisions[0].action).toBe("reminder_failed");
    expect(deps.completedTasks[0].result.failureReason).toMatch(/proveedor caído/);
  });

  test("no existe rama de escalamiento: nunca invoca generateEscalation ni ningún mecanismo de Comunicación", () => {
    const deps = buildDeps();
    expect(deps).not.toHaveProperty("generateEscalation");
    expect(deps).not.toHaveProperty("escalateConversation");
  });
});
