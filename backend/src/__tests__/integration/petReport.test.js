const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  pet: { findFirst: jest.fn() },
  appointment: { findMany: jest.fn() },
  medicalRecord: { findMany: jest.fn() },
  petNextAction: { findMany: jest.fn() },
}));

const prisma = require("../../lib/prisma");
const dashboardRoutes = require("../../routes/dashboard.routes");

const TENANT_ID = "tenant-a";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenant = { isSuperAdmin: false, tenantId: TENANT_ID };
    next();
  });
  app.use("/api/dashboard", dashboardRoutes);
  return app;
}

const app = buildApp();

const PET = {
  id: "pet-1",
  name: "Max",
  type: "dog",
  breed: "Labrador",
  gender: "M",
  birthDate: new Date("2020-03-01"),
  weight: 12.5,
  sterilized: true,
  notes: null,
  createdAt: new Date("2021-01-01"),
  owner: { id: "user-1", name: "Juan Pérez", phone: "573001234567", email: null, address: null },
  tenant: { name: "Mateos Pet", phone: "573009999999", email: null, address: null, logoUrl: null },
};

const COMPLETED_APPT = {
  id: "appt-1",
  petId: "pet-1",
  tenantId: TENANT_ID,
  date: new Date("2026-05-10T15:00:00.000Z"),
  status: "completed",
  serviceType: "veterinary_consultation",
  service: { name: "Consulta general", category: "veterinary" },
  staff: { name: "Dr. Lina" },
  medicalRecord: {
    id: "rec-1",
    staff: { name: "Dr. Lina" },
    reason: "Control anual",
    findings: "Saludable",
    diagnosis: "Sin patologías",
    treatment: null,
    recommendations: "Vacuna en 3 meses",
    weight: 12.5,
    nextControlAt: null,
    detail: null,
  },
};

describe("GET /api/dashboard/pets/:id/report", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.appointment.findMany.mockResolvedValue([]);
    prisma.medicalRecord.findMany.mockResolvedValue([]);
    prisma.petNextAction.findMany.mockResolvedValue([]);
  });

  it("returns 404 when pet not found", async () => {
    prisma.pet.findFirst.mockResolvedValue(null);
    const res = await request(app).get("/api/dashboard/pets/nonexistent/report");
    expect(res.status).toBe(404);
  });

  it("returns 404 for pet from a different tenant", async () => {
    prisma.pet.findFirst.mockResolvedValue(null); // tenantId filter excludes it
    const res = await request(app).get("/api/dashboard/pets/pet-other/report");
    expect(res.status).toBe(404);
  });

  it("returns full report structure for valid pet", async () => {
    prisma.pet.findFirst.mockResolvedValue(PET);
    const res = await request(app).get("/api/dashboard/pets/pet-1/report");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("pet");
    expect(res.body).toHaveProperty("owner");
    expect(res.body).toHaveProperty("tenant");
    expect(res.body).toHaveProperty("timeline");
    expect(res.body).toHaveProperty("weightHistory");
    expect(res.body.pet.name).toBe("Max");
    expect(res.body.owner.name).toBe("Juan Pérez");
    expect(res.body.tenant.name).toBe("Mateos Pet");
  });

  it("includes completed appointment in timeline items", async () => {
    prisma.pet.findFirst.mockResolvedValue(PET);
    prisma.appointment.findMany.mockResolvedValue([COMPLETED_APPT]);
    const res = await request(app).get("/api/dashboard/pets/pet-1/report");
    expect(res.status).toBe(200);
    expect(res.body.timeline.items).toHaveLength(1);
    expect(res.body.timeline.items[0].kind).toBe("consultation");
    expect(res.body.timeline.items[0].staffName).toBe("Dr. Lina");
    expect(res.body.timeline.items[0].reason).toBe("Control anual");
  });

  it("includes weight in weightHistory when medical record has weight", async () => {
    prisma.pet.findFirst.mockResolvedValue(PET);
    prisma.appointment.findMany.mockResolvedValue([COMPLETED_APPT]);
    const res = await request(app).get("/api/dashboard/pets/pet-1/report");
    expect(res.status).toBe(200);
    expect(res.body.weightHistory).toHaveLength(1);
    expect(res.body.weightHistory[0].weight).toBe(12.5);
  });

  it("returns empty weightHistory when no weights recorded", async () => {
    prisma.pet.findFirst.mockResolvedValue(PET);
    const apptNoWeight = {
      ...COMPLETED_APPT,
      medicalRecord: { ...COMPLETED_APPT.medicalRecord, weight: null },
    };
    prisma.appointment.findMany.mockResolvedValue([apptNoWeight]);
    const res = await request(app).get("/api/dashboard/pets/pet-1/report");
    expect(res.status).toBe(200);
    expect(res.body.weightHistory).toHaveLength(0);
  });

  it("includes pending nextActions in timeline", async () => {
    prisma.pet.findFirst.mockResolvedValue(PET);
    prisma.petNextAction.findMany.mockResolvedValue([
      {
        id: "action-1",
        petId: "pet-1",
        tenantId: TENANT_ID,
        type: "vaccine",
        notes: "Rabia anual",
        dueAt: new Date("2026-09-01T00:00:00.000Z"),
        status: "pending",
        sourceRecordId: null,
        sourceAppointmentId: null,
      },
    ]);
    const res = await request(app).get("/api/dashboard/pets/pet-1/report");
    expect(res.status).toBe(200);
    expect(res.body.timeline.nextActions).toHaveLength(1);
    expect(res.body.timeline.nextActions[0].title).toContain("Vacuna");
  });

  // B2: el report comparte la fuente de verdad con /timeline. Antes el report
  // NO generaba la próxima acción de "Cita programada" para citas futuras; este
  // test blinda esa paridad para que el PDF nunca vuelva a divergir de la pantalla.
  it("includes a 'Cita programada' next action for future appointments (paridad con timeline)", async () => {
    prisma.pet.findFirst.mockResolvedValue(PET);
    const future = new Date(Date.now() + 7 * 86400000);
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: "appt-future",
        petId: "pet-1",
        tenantId: TENANT_ID,
        date: future,
        status: "confirmed",
        serviceType: "grooming",
        service: { name: "Baño y corte", category: "grooming" },
        staff: { name: "Sara" },
        medicalRecord: null,
      },
    ]);
    const res = await request(app).get("/api/dashboard/pets/pet-1/report");
    expect(res.status).toBe(200);
    const titles = res.body.timeline.nextActions.map((a) => a.title);
    expect(titles.some((t) => t.startsWith("Cita programada"))).toBe(true);
  });

  it("returns 500 on database error", async () => {
    prisma.pet.findFirst.mockRejectedValue(new Error("db error"));
    const res = await request(app).get("/api/dashboard/pets/pet-1/report");
    expect(res.status).toBe(500);
  });
});
