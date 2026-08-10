/**
 * Entregable 3.2 — Empleados Digitales: camino real HTTP → caso de uso →
 * persistencia para Administración y Consulta. Prisma se mockea a nivel de
 * cliente; el resto de la cadena (rutas, casos de uso, adaptadores) es la
 * real — mismo criterio ya aplicado en communication-paths.test.js.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  digitalEmployee: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  agentAutonomyLimit: { upsert: jest.fn() },
  agentTask: { findMany: jest.fn() },
  agentDecision: { findMany: jest.fn() },
  escalation: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const agentsRoutes = require("../../routes/dashboard/agents.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: "tenant-a" };
    next();
  });
  app.use("/api/dashboard", agentsRoutes);
  return app;
}

beforeEach(() => jest.clearAllMocks());

describe("POST /digital-employees — Registrar Empleado Digital", () => {
  test("registra con specialization válida", async () => {
    prisma.digitalEmployee.create.mockImplementation(async ({ data }) => ({ id: "de-1", ...data }));

    const res = await request(buildApp())
      .post("/api/dashboard/digital-employees")
      .send({ specialization: "recepcionista" });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("activo");
    expect(prisma.digitalEmployee.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-a", specialization: "recepcionista" }) })
    );
  });

  test("rechaza specialization inválida con 400", async () => {
    const res = await request(buildApp())
      .post("/api/dashboard/digital-employees")
      .send({ specialization: "no-existe" });

    expect(res.status).toBe(400);
    expect(prisma.digitalEmployee.create).not.toHaveBeenCalled();
  });
});

describe("POST /digital-employees/:id/pause y /reactivate", () => {
  test("pausar un Empleado Digital inexistente responde 404", async () => {
    prisma.digitalEmployee.findUnique.mockResolvedValue(null);

    const res = await request(buildApp()).post("/api/dashboard/digital-employees/de-1/pause");

    expect(res.status).toBe(404);
  });

  test("pausar un Empleado Digital ya pausado responde 409", async () => {
    prisma.digitalEmployee.findUnique.mockResolvedValue({ id: "de-1", tenantId: "tenant-a", status: "pausado" });

    const res = await request(buildApp()).post("/api/dashboard/digital-employees/de-1/pause");

    expect(res.status).toBe(409);
  });

  test("pausa correctamente un Empleado Digital activo", async () => {
    prisma.digitalEmployee.findUnique.mockResolvedValue({ id: "de-1", tenantId: "tenant-a", status: "activo" });
    prisma.digitalEmployee.update.mockResolvedValue({ id: "de-1", status: "pausado" });

    const res = await request(buildApp()).post("/api/dashboard/digital-employees/de-1/pause");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pausado");
  });
});

describe("GET /digital-employees — Consultar Empleados Digitales", () => {
  test("lista filtrando por tenantId", async () => {
    prisma.digitalEmployee.findMany.mockResolvedValue([{ id: "de-1", specialization: "recepcionista" }]);

    const res = await request(buildApp()).get("/api/dashboard/digital-employees");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(prisma.digitalEmployee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-a" } })
    );
  });
});

describe("GET /escalations/pending y POST /escalations/:id/attend", () => {
  test("lista escalaciones pendientes", async () => {
    prisma.escalation.findMany.mockResolvedValue([{ id: "esc-1", status: "pendiente" }]);

    const res = await request(buildApp()).get("/api/dashboard/escalations/pending");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test("atender una Escalación ya atendida responde 409", async () => {
    prisma.escalation.findUnique.mockResolvedValue({
      id: "esc-1",
      status: "atendida",
      agentTask: { digitalEmployee: { tenantId: "tenant-a" } },
    });

    const res = await request(buildApp()).post("/api/dashboard/escalations/esc-1/attend");

    expect(res.status).toBe(409);
  });

  test("atiende correctamente una Escalación pendiente", async () => {
    prisma.escalation.findUnique.mockResolvedValue({
      id: "esc-1",
      status: "pendiente",
      agentTask: { digitalEmployee: { tenantId: "tenant-a" } },
    });
    prisma.escalation.update.mockResolvedValue({ id: "esc-1", status: "atendida" });

    const res = await request(buildApp()).post("/api/dashboard/escalations/esc-1/attend");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("atendida");
  });
});
