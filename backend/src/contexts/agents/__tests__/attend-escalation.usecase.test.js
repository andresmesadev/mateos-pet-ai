const { createAttendEscalationUseCase } = require("../application/use-cases/attend-escalation.usecase");
const { EscalationNotFoundError, EscalationAlreadyResolvedError } = require("../domain/errors");

const eventPublisher = { publish: async () => {} };

function buildRepository(initial = []) {
  const rows = [...initial];
  return {
    findById: async (id) => rows.find((r) => r.id === id) ?? null,
    resolve: async (id, assignedStaffId) => {
      const row = rows.find((r) => r.id === id);
      row.status = "atendida";
      row.resolvedAt = new Date();
      if (assignedStaffId) row.assignedStaffId = assignedStaffId;
      return row;
    },
  };
}

describe("AttendEscalationUseCase", () => {
  test("rechaza atender una Escalación inexistente", async () => {
    const escalationRepository = buildRepository();
    const execute = createAttendEscalationUseCase({ escalationRepository, eventPublisher });
    await expect(execute({ escalationId: "no-existe" })).rejects.toBeInstanceOf(EscalationNotFoundError);
  });

  test("rechaza atender una Escalación ya atendida", async () => {
    const escalationRepository = buildRepository([{ id: "esc-1", status: "pendiente" }]);
    const execute = createAttendEscalationUseCase({ escalationRepository, eventPublisher });
    await execute({ escalationId: "esc-1" });
    await expect(execute({ escalationId: "esc-1" })).rejects.toBeInstanceOf(EscalationAlreadyResolvedError);
  });

  // Entregable 6.5 — Automatizaciones y Empleados Digitales Multi-Establecimiento.
  test("atiende una Escalación del mismo tenant (verificada vía join agentTask.digitalEmployee.tenantId)", async () => {
    const escalationRepository = buildRepository([
      { id: "esc-1", status: "pendiente", agentTask: { digitalEmployee: { tenantId: "t1" } } },
    ]);
    const execute = createAttendEscalationUseCase({ escalationRepository, eventPublisher });
    const { escalation } = await execute({ escalationId: "esc-1", tenantId: "t1" });
    expect(escalation.status).toBe("atendida");
  });

  test("rechaza atender una Escalación de otro tenant como si no existiera", async () => {
    const escalationRepository = buildRepository([
      { id: "esc-1", status: "pendiente", agentTask: { digitalEmployee: { tenantId: "t2" } } },
    ]);
    const execute = createAttendEscalationUseCase({ escalationRepository, eventPublisher });
    await expect(execute({ escalationId: "esc-1", tenantId: "t1" })).rejects.toBeInstanceOf(EscalationNotFoundError);
  });

  test("sin tenantId (uso interno) no filtra por tenant", async () => {
    const escalationRepository = buildRepository([
      { id: "esc-1", status: "pendiente", agentTask: { digitalEmployee: { tenantId: "t2" } } },
    ]);
    const execute = createAttendEscalationUseCase({ escalationRepository, eventPublisher });
    const { escalation } = await execute({ escalationId: "esc-1" });
    expect(escalation.status).toBe("atendida");
  });
});
