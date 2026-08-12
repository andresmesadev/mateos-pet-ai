/**
 * Reserva de Cita (Ecosistema, Portal del Cliente): verifica
 * POST /api/public/appointments — apiKeyAuth + clientAuth + scope
 * write:appointments, verificación cruzada ApiKey/ClientSession,
 * aislamiento por tenant, mapeo veterinary→vet/grooming→grooming,
 * SlotAlreadyBookedError→409, y respuesta pública mínima.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  apiKey: { findUnique: jest.fn(), update: jest.fn() },
  clientSession: { findUnique: jest.fn(), update: jest.fn() },
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
}));

const prisma = require("../../lib/prisma");
const { getServiceCategory } = require("../../contexts/services");
const { ServiceNotFoundError } = require("../../contexts/services/domain/errors");
const { createAppointment, buildAppointmentDateTime } = require("../../services/appointment.service");
const { SlotAlreadyBookedError } = require("../../services/errors/slot-already-booked.error");
const { apiKeyAuth } = require("../../middleware/apiKeyAuth");
const publicApiRoutes = require("../../routes/public-api.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/public", apiKeyAuth, publicApiRoutes);
  return app;
}

const KEY_TENANT_A = { id: "key-1", tenantId: "tenant-a", scopes: ["write:appointments"], revokedAt: null };
const SESSION_TENANT_A = {
  id: "s1",
  tenantId: "tenant-a",
  userId: "user-1",
  revokedAt: null,
  expiresAt: new Date(Date.now() + 10000),
};

const VALID_BODY = {
  serviceId: "svc-1",
  dateKey: "2026-08-20",
  hour: 11,
  petName: "Firulais",
  petType: "perro",
};

beforeEach(() => {
  jest.clearAllMocks();
  buildAppointmentDateTime.mockReturnValue(new Date("2026-08-20T16:00:00Z"));
});

describe("POST /api/public/appointments — autenticación y scope", () => {
  test("rechaza sin API key con 401", async () => {
    const res = await request(buildApp()).post("/api/public/appointments").send(VALID_BODY);
    expect(res.status).toBe(401);
    expect(getServiceCategory).not.toHaveBeenCalled();
  });

  test("rechaza sin X-Client-Token con 401 (clientAuth antes que el scope)", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    const res = await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .send(VALID_BODY);
    expect(res.status).toBe(401);
    expect(getServiceCategory).not.toHaveBeenCalled();
  });

  test("rechaza una key sin el scope write:appointments con 403", async () => {
    prisma.apiKey.findUnique.mockResolvedValue({ ...KEY_TENANT_A, scopes: [] });
    prisma.clientSession.findUnique.mockResolvedValue(SESSION_TENANT_A);
    const res = await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send(VALID_BODY);
    expect(res.status).toBe(403);
    expect(getServiceCategory).not.toHaveBeenCalled();
  });
});

describe("POST /api/public/appointments — verificación cruzada ApiKey/ClientSession", () => {
  test("403 si el tenantId de la ApiKey no coincide con el de la ClientSession", async () => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.clientSession.findUnique.mockResolvedValue({ ...SESSION_TENANT_A, tenantId: "tenant-b" });

    const res = await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send(VALID_BODY);

    expect(res.status).toBe(403);
    expect(getServiceCategory).not.toHaveBeenCalled();
    expect(createAppointment).not.toHaveBeenCalled();
  });
});

describe("POST /api/public/appointments — validación y flujo", () => {
  beforeEach(() => {
    prisma.apiKey.findUnique.mockResolvedValue(KEY_TENANT_A);
    prisma.clientSession.findUnique.mockResolvedValue(SESSION_TENANT_A);
  });

  test("400 sin serviceId", async () => {
    const res = await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send({ ...VALID_BODY, serviceId: undefined });
    expect(res.status).toBe(400);
  });

  test("400 sin petName/petType", async () => {
    const res1 = await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send({ ...VALID_BODY, petName: "" });
    expect(res1.status).toBe(400);

    const res2 = await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send({ ...VALID_BODY, petType: "" });
    expect(res2.status).toBe(400);
  });

  test("404 si el serviceId no existe o pertenece a otro tenant", async () => {
    getServiceCategory.mockRejectedValue(new ServiceNotFoundError("svc-otro"));
    const res = await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send(VALID_BODY);
    expect(res.status).toBe(404);
    expect(createAppointment).not.toHaveBeenCalled();
  });

  test("422 si la categoría del servicio no tiene bucket de disponibilidad", async () => {
    getServiceCategory.mockResolvedValue({ categoryName: "other" });
    const res = await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send(VALID_BODY);
    expect(res.status).toBe(422);
    expect(createAppointment).not.toHaveBeenCalled();
  });

  test("400 si dateKey/hour son inválidos (buildAppointmentDateTime lanza)", async () => {
    getServiceCategory.mockResolvedValue({ categoryName: "veterinary" });
    buildAppointmentDateTime.mockImplementation(() => {
      throw new Error("Invalid dateKey or hour for appointment");
    });
    const res = await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send(VALID_BODY);
    expect(res.status).toBe(400);
    expect(createAppointment).not.toHaveBeenCalled();
  });

  test("409 si el horario ya fue reservado (SlotAlreadyBookedError)", async () => {
    getServiceCategory.mockResolvedValue({ categoryName: "veterinary" });
    createAppointment.mockRejectedValue(new SlotAlreadyBookedError({}));
    const res = await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send(VALID_BODY);
    expect(res.status).toBe(409);
  });

  test("veterinary → serviceType 'vet' pasado a createAppointment", async () => {
    getServiceCategory.mockResolvedValue({ categoryName: "veterinary" });
    createAppointment.mockResolvedValue({ id: "appt-1", date: new Date(), status: "confirmed", petName: "Firulais", petType: "perro" });

    await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send(VALID_BODY);

    expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({ serviceType: "vet" }));
  });

  test("grooming → serviceType 'grooming' pasado a createAppointment", async () => {
    getServiceCategory.mockResolvedValue({ categoryName: "grooming" });
    createAppointment.mockResolvedValue({ id: "appt-2", date: new Date(), status: "confirmed", petName: "Michi", petType: "gato" });

    await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send(VALID_BODY);

    expect(createAppointment).toHaveBeenCalledWith(expect.objectContaining({ serviceType: "grooming" }));
  });

  test("userId exclusivamente de req.clientAuth.userId y tenantId exclusivamente de req.apiKey.tenantId, ignorando el body", async () => {
    getServiceCategory.mockResolvedValue({ categoryName: "veterinary" });
    createAppointment.mockResolvedValue({ id: "appt-1", date: new Date(), status: "confirmed", petName: "Firulais", petType: "perro" });

    await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send({ ...VALID_BODY, userId: "user-falsificado", tenantId: "tenant-falsificado" });

    expect(createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", tenantId: "tenant-a" })
    );
  });

  test("201 con respuesta pública mínima, sin tenantId/userId/googleEventId", async () => {
    getServiceCategory.mockResolvedValue({ categoryName: "veterinary" });
    createAppointment.mockResolvedValue({
      id: "appt-1",
      date: new Date("2026-08-20T16:00:00Z"),
      status: "confirmed",
      petName: "Firulais",
      petType: "perro",
      tenantId: "tenant-a",
      userId: "user-1",
      googleEventId: "evt-123",
      availabilityBucket: "vet",
    });

    const res = await request(buildApp())
      .post("/api/public/appointments")
      .set("Authorization", "Bearer valida")
      .set("X-Client-Token", "valido")
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(["date", "id", "petName", "petType", "status"].sort());
  });
});
