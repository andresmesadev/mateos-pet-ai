const { createProcessReminderUseCase } = require("../application/use-cases/process-reminder.usecase");

function buildDeps({ reminderEngineImpl, autonomyLimit = null } = {}) {
  const decisions = [];
  const completedTasks = [];
  const escalations = [];

  const startAgentTask = async () => ({ task: { id: "task-1", status: "en_proceso" } });
  const registerAgentDecision = async (data) => {
    decisions.push(data);
    return { decision: { id: "dec-1", ...data } };
  };
  const completeAgentTask = async (data) => {
    completedTasks.push(data);
    return { task: { id: data.agentTaskId, status: "completada" } };
  };
  // Entregable 5.3 — Aplicación Real de Límite de Autonomía. Por defecto no
  // hay ninguna configuración (null): AUSENCIA DE CONFIGURACIÓN → AUTOAPROBADO.
  const getAutonomyLimit = async () => autonomyLimit;
  const generateEscalation = async (data) => {
    escalations.push(data);
    return { escalation: { id: "esc-1", ...data } };
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
    getAutonomyLimit,
    generateEscalation,
    reminderEngine,
    logger: { error: () => {} },
    decisions,
    completedTasks,
    escalations,
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

  // Entregable 5.3 — Aplicación Real de Límite de Autonomía.
  describe("Límite de Autonomía", () => {
    test("sin configuración: se comporta exactamente igual que antes de 5.3 (AUSENCIA DE CONFIGURACIÓN → AUTOAPROBADO → se envía)", async () => {
      const deps = buildDeps({ autonomyLimit: null });
      const execute = createProcessReminderUseCase(deps);

      const result = await execute({ digitalEmployeeId: "de-1", reminderType: "appointment", entity: { id: "appt-1" } });

      expect(result.sent).toBe(true);
      expect(result.escalated).toBeUndefined();
      expect(deps.decisions[0].action).toBe("reminder_sent");
      expect(deps.completedTasks).toHaveLength(1);
      expect(deps.escalations).toHaveLength(0);
    });

    test("autoApproved=true: se envía normalmente, sin escalar", async () => {
      const deps = buildDeps({ autonomyLimit: { id: "lim-1", digitalEmployeeId: "de-1", action: "appointment", autoApproved: true } });
      const execute = createProcessReminderUseCase(deps);

      const result = await execute({ digitalEmployeeId: "de-1", reminderType: "appointment", entity: { id: "appt-1" } });

      expect(result.sent).toBe(true);
      expect(deps.decisions[0].action).toBe("reminder_sent");
      expect(deps.completedTasks).toHaveLength(1);
      expect(deps.escalations).toHaveLength(0);
    });

    test("autoApproved=false: NO ejecuta reminderEngine, genera Escalación y registra Decisión 'reminder_escalated'", async () => {
      const engineSpy = jest.fn(async () => true);
      const deps = buildDeps({
        autonomyLimit: { id: "lim-1", digitalEmployeeId: "de-1", action: "vaccine", autoApproved: false },
        reminderEngineImpl: { sendAndMarkVaccineReminder: engineSpy },
      });
      const execute = createProcessReminderUseCase(deps);

      const result = await execute({ digitalEmployeeId: "de-1", reminderType: "vaccine", entity: { id: "rec-1" } });

      expect(engineSpy).not.toHaveBeenCalled();
      expect(result.sent).toBe(false);
      expect(result.escalated).toBe(true);
      expect(deps.decisions[0].action).toBe("reminder_escalated");
      expect(deps.escalations).toHaveLength(1);
      expect(deps.escalations[0].agentTaskId).toBe("task-1");
      // Bloqueado: la Tarea se cierra por escalamiento, nunca por completeAgentTask.
      expect(deps.completedTasks).toHaveLength(0);
    });

    test("el límite se consulta por (digitalEmployeeId, reminderType) exacto", async () => {
      const getAutonomyLimitSpy = jest.fn(async () => null);
      const deps = buildDeps();
      deps.getAutonomyLimit = getAutonomyLimitSpy;
      const execute = createProcessReminderUseCase(deps);

      await execute({ digitalEmployeeId: "de-9", reminderType: "grooming", entity: { id: "e-1" } });

      expect(getAutonomyLimitSpy).toHaveBeenCalledWith("de-9", "grooming");
    });
  });
});
