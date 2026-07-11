const { createConfigureAutonomyLimitUseCase } = require("../application/use-cases/configure-autonomy-limit.usecase");
const { DigitalEmployeeNotFoundError, InvalidDigitalEmployeeAttributesError } = require("../domain/errors");

function buildRepository(initial = []) {
  const rows = [...initial];
  const limits = [];
  return {
    findById: async (id) => rows.find((r) => r.id === id) ?? null,
    setAutonomyLimit: async (digitalEmployeeId, action, autoApproved) => {
      const limit = { id: `lim-${limits.length + 1}`, digitalEmployeeId, action, autoApproved };
      limits.push(limit);
      return limit;
    },
  };
}

function buildEventPublisher() {
  const events = [];
  return { events, publish: async (eventName, payload) => events.push({ eventName, payload }) };
}

describe("ConfigureAutonomyLimitUseCase", () => {
  test("configura el límite y emite LimiteDeAutonomiaConfigurado con el tenantId del Empleado Digital", async () => {
    const digitalEmployeeRepository = buildRepository([{ id: "de-1", tenantId: "t1", specialization: "recepcionista" }]);
    const eventPublisher = buildEventPublisher();
    const execute = createConfigureAutonomyLimitUseCase({ digitalEmployeeRepository, eventPublisher });

    const { limit } = await execute({ digitalEmployeeId: "de-1", action: "responder_mensaje", autoApproved: true });

    expect(limit.action).toBe("responder_mensaje");
    expect(eventPublisher.events).toHaveLength(1);
    expect(eventPublisher.events[0].eventName).toBe("LimiteDeAutonomiaConfigurado");
    // Entregable 5.2 — Certificación Real de Eventos por Contexto.
    expect(eventPublisher.events[0].payload.tenantId).toBe("t1");
  });

  test("un Empleado Digital global (tenantId null) propaga tenantId null en el payload — el adaptador de certificación lo omite sin fallar", async () => {
    const digitalEmployeeRepository = buildRepository([{ id: "de-2", tenantId: null, specialization: "coordinador_agenda" }]);
    const eventPublisher = buildEventPublisher();
    const execute = createConfigureAutonomyLimitUseCase({ digitalEmployeeRepository, eventPublisher });

    await execute({ digitalEmployeeId: "de-2", action: "reprogramar_cita", autoApproved: false });

    expect(eventPublisher.events[0].payload.tenantId).toBeNull();
  });

  test("rechaza si el Empleado Digital no existe", async () => {
    const digitalEmployeeRepository = buildRepository([]);
    const eventPublisher = buildEventPublisher();
    const execute = createConfigureAutonomyLimitUseCase({ digitalEmployeeRepository, eventPublisher });

    await expect(execute({ digitalEmployeeId: "no-existe", action: "x" })).rejects.toBeInstanceOf(
      DigitalEmployeeNotFoundError
    );
  });

  test("rechaza si action está vacío", async () => {
    const digitalEmployeeRepository = buildRepository([{ id: "de-1", tenantId: "t1" }]);
    const eventPublisher = buildEventPublisher();
    const execute = createConfigureAutonomyLimitUseCase({ digitalEmployeeRepository, eventPublisher });

    await expect(execute({ digitalEmployeeId: "de-1", action: "  " })).rejects.toBeInstanceOf(
      InvalidDigitalEmployeeAttributesError
    );
  });
});
