/**
 * Entregable 3.3 — Automatizaciones: camino real HTTP → caso de uso →
 * persistencia para Administración y Consulta. Prisma se mockea a nivel de
 * cliente; el resto de la cadena (rutas, casos de uso, adaptadores) es la
 * real — mismo criterio ya aplicado en agents-paths.test.js.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  automationRule: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  automationTemplate: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
  automationExecution: { findMany: jest.fn() },
  eventType: { findUnique: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const automationsRoutes = require("../../routes/dashboard/automations.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: "tenant-a" };
    next();
  });
  app.use("/api/dashboard", automationsRoutes);
  return app;
}

beforeEach(() => jest.clearAllMocks());

describe("POST /automation-rules — Registrar Regla de Automatización", () => {
  test("rechaza disparador inexistente con 404", async () => {
    prisma.eventType.findUnique.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/dashboard/automation-rules")
      .send({ name: "r1", triggerEventTypeName: "NoExiste", actionType: "asignar_tarea_empleado", actionConfig: { digitalEmployeeId: "de-1" } });

    expect(res.status).toBe(404);
    expect(prisma.automationRule.create).not.toHaveBeenCalled();
  });

  test("registra correctamente resolviendo el triggerEventTypeId real", async () => {
    prisma.eventType.findUnique.mockResolvedValue({ id: "et-1", name: "CitaCompletada", active: true });
    prisma.automationRule.create.mockImplementation(async ({ data }) => ({ id: "rule-1", ...data }));

    const res = await request(buildApp())
      .post("/api/dashboard/automation-rules")
      .send({
        name: "Asignar recepcionista",
        triggerEventTypeName: "CitaCompletada",
        actionType: "asignar_tarea_empleado",
        actionConfig: { digitalEmployeeId: "de-1" },
      });

    expect(res.status).toBe(201);
    expect(prisma.automationRule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-a", triggerEventTypeId: "et-1" }) })
    );
  });

  test("rechaza actionType inválido con 400", async () => {
    const res = await request(buildApp())
      .post("/api/dashboard/automation-rules")
      .send({ name: "r1", triggerEventTypeName: "CitaCompletada", actionType: "no-existe", actionConfig: {} });

    expect(res.status).toBe(400);
    expect(prisma.eventType.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /automation-rules/:id/activate y /deactivate", () => {
  test("activar una Regla inexistente responde 404", async () => {
    prisma.automationRule.findUnique.mockResolvedValue(null);

    const res = await request(buildApp()).post("/api/dashboard/automation-rules/rule-1/activate");

    expect(res.status).toBe(404);
  });

  test("desactivar es idempotente (200) incluso si ya está inactiva", async () => {
    prisma.automationRule.findUnique.mockResolvedValue({ id: "rule-1", active: false });

    const res = await request(buildApp()).post("/api/dashboard/automation-rules/rule-1/deactivate");

    expect(res.status).toBe(200);
    expect(prisma.automationRule.update).not.toHaveBeenCalled();
  });
});

describe("GET /automation-rules y /automation-rules/:id/executions", () => {
  test("lista Reglas filtrando por tenantId", async () => {
    prisma.automationRule.findMany.mockResolvedValue([{ id: "rule-1" }]);

    const res = await request(buildApp()).get("/api/dashboard/automation-rules");

    expect(res.status).toBe(200);
    expect(prisma.automationRule.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-a" } }));
  });

  test("consultar ejecuciones de una Regla inexistente responde 404", async () => {
    prisma.automationRule.findUnique.mockResolvedValue(null);

    const res = await request(buildApp()).get("/api/dashboard/automation-rules/rule-1/executions");

    expect(res.status).toBe(404);
  });

  test("consultar ejecuciones de una Regla existente responde 200", async () => {
    prisma.automationRule.findUnique.mockResolvedValue({ id: "rule-1" });
    prisma.automationExecution.findMany.mockResolvedValue([{ id: "exec-1", status: "success" }]);

    const res = await request(buildApp()).get("/api/dashboard/automation-rules/rule-1/executions");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("POST /automation-templates y /automation-templates/:id/activate", () => {
  test("registra una Plantilla resolviendo el triggerEventTypeId real", async () => {
    prisma.eventType.findUnique.mockResolvedValue({ id: "et-1", name: "CitaCompletada", active: true });
    prisma.automationTemplate.create.mockImplementation(async ({ data }) => ({ id: "tpl-1", ...data }));

    const res = await request(buildApp())
      .post("/api/dashboard/automation-templates")
      .send({
        name: "Notificar cliente al completar cita",
        triggerEventTypeName: "CitaCompletada",
        defaultActionType: "enviar_mensaje",
        defaultActionConfig: { content: "Gracias por tu visita" },
      });

    expect(res.status).toBe(201);
  });

  test("activar una Plantilla inexistente responde 404", async () => {
    prisma.automationTemplate.findUnique.mockResolvedValue(null);

    const res = await request(buildApp()).post("/api/dashboard/automation-templates/tpl-1/activate");

    expect(res.status).toBe(404);
  });

  test("activar una Plantilla existente crea una Regla propia del tenant", async () => {
    prisma.automationTemplate.findUnique.mockResolvedValue({
      id: "tpl-1",
      name: "Plantilla X",
      triggerEventTypeId: "et-1",
      defaultCondition: null,
      defaultActionType: "asignar_tarea_empleado",
      defaultActionConfig: { digitalEmployeeId: "de-1" },
    });
    prisma.automationRule.create.mockImplementation(async ({ data }) => ({ id: "rule-1", ...data }));

    const res = await request(buildApp()).post("/api/dashboard/automation-templates/tpl-1/activate");

    expect(res.status).toBe(201);
    expect(prisma.automationRule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-a", templateId: "tpl-1" }) })
    );
  });
});
