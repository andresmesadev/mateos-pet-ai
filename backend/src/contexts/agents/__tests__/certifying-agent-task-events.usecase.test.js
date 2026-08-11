/**
 * Precondición de Ecosistema — Certificación de los 5 eventos del ciclo de
 * vida de Empleados Digitales (TareaIniciada, TareaCompletada,
 * DecisiónRegistrada, EscalaciónGenerada, EscalaciónAtendida), omitidos
 * desde el Entregable 5.2 por no tener tenantId resoluble estructuralmente.
 * Verifica que cada eventPublisher.publish(...) recibe el tenantId correcto
 * del establecimiento propietario — ya disponible en memoria vía los joins
 * de 3.2/6.5, sin ninguna consulta nueva.
 */
const { createStartAgentTaskUseCase } = require("../application/use-cases/start-agent-task.usecase");
const { createCompleteAgentTaskUseCase } = require("../application/use-cases/complete-agent-task.usecase");
const { createRegisterAgentDecisionUseCase } = require("../application/use-cases/register-agent-decision.usecase");
const { createGenerateEscalationUseCase } = require("../application/use-cases/generate-escalation.usecase");
const { createAttendEscalationUseCase } = require("../application/use-cases/attend-escalation.usecase");

function buildPublisher() {
  const calls = [];
  return { calls, publish: async (eventName, payload) => { calls.push({ eventName, payload }); } };
}

describe("Certificación de eventos de Empleados Digitales — tenantId en el payload", () => {
  test("TareaIniciada lleva el tenantId del Empleado Digital (employee.tenantId)", async () => {
    const eventPublisher = buildPublisher();
    const digitalEmployeeRepository = {
      findById: async () => ({ id: "de-1", status: "activo", tenantId: "tenant-a" }),
    };
    const agentTaskRepository = { create: async (data) => ({ id: "task-1", ...data }) };
    const execute = createStartAgentTaskUseCase({ digitalEmployeeRepository, agentTaskRepository, eventPublisher });

    await execute({ digitalEmployeeId: "de-1", origin: "webhook" });

    expect(eventPublisher.calls).toHaveLength(1);
    expect(eventPublisher.calls[0].eventName).toBe("TareaIniciada");
    expect(eventPublisher.calls[0].payload.tenantId).toBe("tenant-a");
  });

  test("TareaCompletada lleva el tenantId de task.digitalEmployee.tenantId (join de findById)", async () => {
    const eventPublisher = buildPublisher();
    const agentTaskRepository = {
      findById: async () => ({
        id: "task-1",
        status: "en_proceso",
        digitalEmployee: { tenantId: "tenant-b" },
      }),
      complete: async (id, result) => ({ id, status: "completada", result }),
    };
    const execute = createCompleteAgentTaskUseCase({ agentTaskRepository, eventPublisher });

    await execute({ agentTaskId: "task-1" });

    expect(eventPublisher.calls).toHaveLength(1);
    expect(eventPublisher.calls[0].eventName).toBe("TareaCompletada");
    expect(eventPublisher.calls[0].payload.tenantId).toBe("tenant-b");
  });

  test("DecisiónRegistrada lleva el tenantId de task.digitalEmployee.tenantId", async () => {
    const eventPublisher = buildPublisher();
    const agentTaskRepository = {
      findById: async () => ({
        id: "task-1",
        status: "en_proceso",
        digitalEmployee: { tenantId: "tenant-c" },
      }),
    };
    const agentDecisionRepository = { create: async (data) => ({ id: "dec-1", ...data }) };
    const execute = createRegisterAgentDecisionUseCase({ agentTaskRepository, agentDecisionRepository, eventPublisher });

    await execute({ agentTaskId: "task-1", input: {}, reasoning: "r", action: "a" });

    expect(eventPublisher.calls).toHaveLength(1);
    expect(eventPublisher.calls[0].eventName).toBe("DecisiónRegistrada");
    expect(eventPublisher.calls[0].payload.tenantId).toBe("tenant-c");
  });

  test("EscalaciónGenerada lleva el tenantId de task.digitalEmployee.tenantId", async () => {
    const eventPublisher = buildPublisher();
    const agentTaskRepository = {
      findById: async () => ({
        id: "task-1",
        status: "en_proceso",
        digitalEmployee: { tenantId: "tenant-d" },
      }),
      escalate: async () => {},
    };
    const escalationRepository = { create: async (data) => ({ id: "esc-1", ...data }) };
    const execute = createGenerateEscalationUseCase({ agentTaskRepository, escalationRepository, eventPublisher });

    await execute({ agentTaskId: "task-1", context: { motivo: "no_resuelto" } });

    expect(eventPublisher.calls).toHaveLength(1);
    expect(eventPublisher.calls[0].eventName).toBe("EscalaciónGenerada");
    expect(eventPublisher.calls[0].payload.tenantId).toBe("tenant-d");
  });

  test("EscalaciónAtendida lleva el tenantId ya resuelto por el checkpoint de autorización (ownerTenantId)", async () => {
    const eventPublisher = buildPublisher();
    const escalationRepository = {
      findById: async () => ({
        id: "esc-1",
        status: "pendiente",
        agentTask: { digitalEmployee: { tenantId: "tenant-e" } },
      }),
      resolve: async (id) => ({ id, status: "atendida" }),
    };
    const execute = createAttendEscalationUseCase({ escalationRepository, eventPublisher });

    await execute({ escalationId: "esc-1", tenantId: "tenant-e" });

    expect(eventPublisher.calls).toHaveLength(1);
    expect(eventPublisher.calls[0].eventName).toBe("EscalaciónAtendida");
    expect(eventPublisher.calls[0].payload.tenantId).toBe("tenant-e");
  });

  test("el tenantId certificado nunca proviene de otra entidad: dos Empleados Digitales de distinto tenant producen tenantId distinto", async () => {
    const eventPublisher = buildPublisher();
    const digitalEmployeeRepository = {
      findById: async (id) =>
        id === "de-1"
          ? { id: "de-1", status: "activo", tenantId: "tenant-x" }
          : { id: "de-2", status: "activo", tenantId: "tenant-y" },
    };
    const agentTaskRepository = { create: async (data) => ({ id: `task-${data.digitalEmployeeId}`, ...data }) };
    const execute = createStartAgentTaskUseCase({ digitalEmployeeRepository, agentTaskRepository, eventPublisher });

    await execute({ digitalEmployeeId: "de-1", origin: "webhook" });
    await execute({ digitalEmployeeId: "de-2", origin: "webhook" });

    expect(eventPublisher.calls[0].payload.tenantId).toBe("tenant-x");
    expect(eventPublisher.calls[1].payload.tenantId).toBe("tenant-y");
    expect(eventPublisher.calls[0].payload.tenantId).not.toBe(eventPublisher.calls[1].payload.tenantId);
  });

  test("TareaCompletada con digitalEmployee ausente en el join certifica tenantId null, sin lanzar ni inventar un tenant", async () => {
    const eventPublisher = buildPublisher();
    const agentTaskRepository = {
      findById: async () => ({ id: "task-1", status: "en_proceso" }), // sin digitalEmployee — caso límite defensivo
      complete: async (id, result) => ({ id, status: "completada", result }),
    };
    const execute = createCompleteAgentTaskUseCase({ agentTaskRepository, eventPublisher });

    await execute({ agentTaskId: "task-1" });

    expect(eventPublisher.calls[0].payload.tenantId).toBeNull();
  });

  test("contrato del use case intacto: el valor de retorno no incluye tenantId, solo el payload publicado lo lleva", async () => {
    const eventPublisher = buildPublisher();
    const digitalEmployeeRepository = {
      findById: async () => ({ id: "de-1", status: "activo", tenantId: "tenant-a" }),
    };
    const agentTaskRepository = { create: async (data) => ({ id: "task-1", ...data }) };
    const execute = createStartAgentTaskUseCase({ digitalEmployeeRepository, agentTaskRepository, eventPublisher });

    const result = await execute({ digitalEmployeeId: "de-1", origin: "webhook" });

    expect(result).toEqual({ task: { id: "task-1", digitalEmployeeId: "de-1", origin: "webhook", status: "en_proceso" } });
  });
});
