/**
 * Gestión de Cita (Ecosistema, Portal del Cliente): verifica
 * GET /api/public/appointments y POST /api/public/appointments/:id/cancel
 * — apiKeyAuth + clientAuth + scopes, verificación cruzada, ownership
 * obligatorio, reutilización de isAllowedTransition/syncCancelToCalendar,
 * y forma pública mínima de la respuesta.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  apiKey: { findUnique: jest.fn(), update: jest.fn() },
  clientSession: { findUnique: jest.fn(), update: jest.fn() },
  appointment: { findFirst: jest.fn(), update: jest.fn() },
}));

jest.mock("../../contexts/services", () => ({
  listAvailableServices: jest.fn(),
  getServiceCategory: jest.fn(),
}));

jest.mock("../../contexts/staff", () => ({
  resolveStaffAvailability: jest.fn(),
}));

jest.mock("../../services/availability-db.service", () => ({
  suggestAvailableVetSlots: jest.fn(),
  findNextAvailableGroomingSlot: jest.fn(),
}));

jest.mock("../../services/appointment.service", () => ({
  createAppointment: jest.fn(),
  buildAppointmentDateTime: jest.fn(),
  getUserAppointments: jest.fn(),
  syncCancelToCalendar: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { getUserAppointments, syncCancelToCalendar } = require("../../services/appointment.service");
const { apiKeyAuth } = require("../../middleware/apiKeyAuth");
const publicApiRoutes = require("../../routes/public-api.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/public", apiKeyAuth, publicApiRoutes);
  return app;
}

const KEY_TENANT_A = { id: "key-1", tenantId: "tenant-a", scopes: ["read:appointments", "write:appointments"], revokedAt: null };
const SESSION_TENANT_A = {
  id: "s1",
  tenantId: "tenant-a",
  userId: "user-1",
  revokedAt: null,
  expiresAt: new Date(Date.now() + 10000),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/public/appointments", () => {
  test("rechaza sin API key con 401", async () => {
    const res = await request(buildApp()).get("/api/public/appointments");
    expect(res.status).toBe(401);
    expect(getUserAppointments).not.toHaveBeenCalled();
  });

  test("rechaza sin X-Client-Token con 401", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    const res = await request(buildApp()).get("/api/public/appointments").set("Authorization", "Bearer valida");
    expect(res.status).toBe(401);
    expect(getUserAppointments).not.toHaveBeenCalled();
  });

  test("rechaza sin scope read:appointments con 403", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ ...KEY_TENANT_A, scopes: ["write:appointments"] });
    prisma.clientSession.findUnique.mockResolvedValue(SESSION_TENANT_A);
    const res = await request(buildApp())
      .get("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido");
    expect(res.status).toBe(403);
    expect(getUserAppointments).not.toHaveBeenCalled();
  });

  test("403 si el tenantId de la ApiKey no coincide con el de la ClientSession", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.clientSession.findUnique.mockResolvedValue({ ...SESSION_TENANT_A, tenantId: "tenant-b" });
    const res = await request(buildApp())
      .get("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido");
    expect(res.status).toBe(403);
    expect(getUserAppointments).not.toHaveBeenCalled();
  });

  test("200 con la propia lista de citas, en forma pública mínima", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.clientSession.findUnique.mockResolvedValue(SESSION_TENANT_A);
    getUserAppointments.mockResolvedValue([
      {
        id: "appt-1",
        date: new Date("2026-08-25T15:00:00Z"),
        status: "confirmed",
        petName: "Firulais",
        petType: "perro",
        tenantId: "tenant-a",
        userId: "user-1",
        googleEventId: "evt-1",
      },
    ]);

    const res = await request(buildApp())
      .get("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido");

    expect(res.status).toBe(200);
    expect(getUserAppointments).toHaveBeenCalledWith("user-1");
    expect(res.body.appointments).toHaveLength(1);
    expect(Object.keys(res.body.appointments[0]).sort()).toEqual(["date", "id", "petName", "petType", "status"].sort());
  });
});

describe("POST /api/public/appointments/:id/cancel", () => {
  test("rechaza sin API key con 401", async () => {
    const res = await request(buildApp()).post("/api/public/appointments/appt-1/cancel");
    expect(res.status).toBe(401);
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
  });

  test("rechaza sin scope write:appointments con 403", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ ...KEY_TENANT_A, scopes: ["read:appointments"] });
    prisma.clientSession.findUnique.mockResolvedValue(SESSION_TENANT_A);
    const res = await request(buildApp())
      .post("/api/public/appointments/appt-1/cancel")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido");
    expect(res.status).toBe(403);
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
  });

  test("403 si el tenantId de la ApiKey no coincide con el de la ClientSession", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.clientSession.findUnique.mockResolvedValue({ ...SESSION_TENANT_A, tenantId: "tenant-b" });
    const res = await request(buildApp())
      .post("/api/public/appointments/appt-1/cancel")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido");
    expect(res.status).toBe(403);
    expect(prisma.appointment.findFirst).not.toHaveBeenCalled();
  });

  test("404 si la cita no existe, o pertenece a otro usuario, o a otro tenant (misma respuesta)", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.clientSession.findUnique.mockResolvedValue(SESSION_TENANT_A);
    prisma.appointment.findFirst.mockResolvedValue(null);

    const res = await request(buildApp())
      .post("/api/public/appointments/appt-ajena/cancel")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido");

    expect(res.status).toBe(404);
    expect(prisma.appointment.findFirst).toHaveBeenCalledWith({
      where: { id: "appt-ajena", userId: "user-1", tenantId: "tenant-a" },
    });
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  test("422 si la cita ya no admite cancelación (p. ej. completed)", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.clientSession.findUnique.mockResolvedValue(SESSION_TENANT_A);
    prisma.appointment.findFirst.mockResolvedValue({ id: "appt-1", status: "completed", userId: "user-1", tenantId: "tenant-a" });

    const res = await request(buildApp())
      .post("/api/public/appointments/appt-1/cancel")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido");

    expect(res.status).toBe(422);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  test("200 cancela una cita propia en estado 'confirmed', sincroniza calendario y responde forma pública mínima", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.clientSession.findUnique.mockResolvedValue(SESSION_TENANT_A);
    prisma.appointment.findFirst.mockResolvedValue({ id: "appt-1", status: "confirmed", userId: "user-1", tenantId: "tenant-a" });
    prisma.appointment.update.mockResolvedValue({
      id: "appt-1",
      status: "cancelled",
      date: new Date("2026-08-25T15:00:00Z"),
      petName: "Firulais",
      petType: "perro",
      tenantId: "tenant-a",
      userId: "user-1",
      googleEventId: "evt-1",
    });

    const res = await request(buildApp())
      .post("/api/public/appointments/appt-1/cancel")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido");

    expect(res.status).toBe(200);
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt-1" },
      data: { status: "cancelled" },
    });
    expect(syncCancelToCalendar).toHaveBeenCalledWith(expect.objectContaining({ id: "appt-1", status: "cancelled" }));
    expect(Object.keys(res.body).sort()).toEqual(["date", "id", "petName", "petType", "status"].sort());
  });

  test("cancela una cita en estado 'pending' (también transición válida)", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.clientSession.findUnique.mockResolvedValue(SESSION_TENANT_A);
    prisma.appointment.findFirst.mockResolvedValue({ id: "appt-2", status: "pending", userId: "user-1", tenantId: "tenant-a" });
    prisma.appointment.update.mockResolvedValue({ id: "appt-2", status: "cancelled", date: new Date(), petName: "Michi", petType: "gato" });

    const res = await request(buildApp())
      .post("/api/public/appointments/appt-2/cancel")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido");

    expect(res.status).toBe(200);
  });
});
