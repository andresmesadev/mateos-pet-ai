const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  pet: { findFirst: jest.fn() },
  appointment: { findMany: jest.fn() },
  medicalRecord: { findMany: jest.fn() },
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

const consultationRecord = {
  id: "record-consultation",
  type: "consultation",
  title: "Consulta veterinaria",
  date: new Date("2026-06-16T16:00:00.000Z"),
  createdAt: new Date("2026-06-16T16:00:00.000Z"),
  staff: { name: "Lina" },
  reason: "Control general",
  findings: "Sin novedades",
  diagnosis: null,
  treatment: null,
  recommendations: null,
  weight: 8.4,
  nextControlAt: new Date("2026-06-25T16:00:00.000Z"),
  detail: null,
};

const appointments = [
  {
    id: "appointment-consultation",
    tenantId: TENANT_ID,
    petId: "pet-1",
    date: new Date("2026-06-16T16:00:00.000Z"),
    status: "completed",
    serviceType: "veterinary_consultation",
    service: { name: "Consulta general", category: "veterinary" },
    staff: { name: "Lina" },
    medicalRecord: consultationRecord,
  },
  {
    id: "appointment-grooming",
    tenantId: TENANT_ID,
    petId: "pet-1",
    date: new Date("2026-06-18T16:00:00.000Z"),
    status: "confirmed",
    serviceType: "baño + corte",
    service: null,
    staff: { name: "Groomer" },
    medicalRecord: null,
  },
  {
    id: "appointment-no-show",
    tenantId: TENANT_ID,
    petId: "pet-1",
    date: new Date("2026-06-10T16:00:00.000Z"),
    status: "no_show",
    serviceType: "vet",
    service: null,
    staff: null,
    medicalRecord: null,
  },
];

const standaloneRecords = [
  {
    id: "record-vaccine",
    type: "vaccine",
    title: "Antirrábica",
    date: new Date("2026-06-20T16:00:00.000Z"),
    createdAt: new Date("2026-05-20T16:00:00.000Z"),
    staff: null,
    reason: null,
    findings: null,
    diagnosis: null,
    treatment: null,
    recommendations: null,
    weight: null,
    nextControlAt: null,
    detail: "Refuerzo anual",
  },
  {
    id: "record-note",
    type: "note",
    title: "Imagen recibida",
    date: null,
    createdAt: new Date("2026-06-15T16:00:00.000Z"),
    staff: null,
    reason: null,
    findings: null,
    diagnosis: null,
    treatment: null,
    recommendations: null,
    weight: null,
    nextControlAt: null,
    detail: "Sin signos visibles de alarma",
  },
  {
    id: "record-deworming",
    type: "note",
    title: "Desparasitación interna",
    date: new Date("2026-06-14T16:00:00.000Z"),
    createdAt: new Date("2026-06-14T16:00:00.000Z"),
    staff: null,
    reason: null,
    findings: null,
    diagnosis: null,
    treatment: null,
    recommendations: null,
    weight: null,
    nextControlAt: null,
    detail: null,
  },
];

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-06-17T15:00:00.000Z"));
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  prisma.pet.findFirst.mockResolvedValue({ id: "pet-1" });
  prisma.appointment.findMany.mockResolvedValue(appointments);
  prisma.medicalRecord.findMany.mockResolvedValue(standaloneRecords);
});

describe("GET /api/dashboard/pets/:id/timeline", () => {
  test("returns 404 without exposing events from a pet outside the tenant", async () => {
    prisma.pet.findFirst.mockResolvedValue(null);

    const response = await request(app).get("/api/dashboard/pets/pet-1/timeline");

    expect(response.status).toBe(404);
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
    expect(prisma.medicalRecord.findMany).not.toHaveBeenCalled();
  });

  test("filters appointments by the authorized tenant", async () => {
    const response = await request(app).get("/api/dashboard/pets/pet-1/timeline");

    expect(response.status).toBe(200);
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { petId: "pet-1", tenantId: TENANT_ID } })
    );
  });

  test("merges an appointment and its clinical record into one event", async () => {
    const response = await request(app).get("/api/dashboard/pets/pet-1/timeline");

    expect(response.status).toBe(200);
    const consultation = response.body.items.find(
      (item) => item.appointmentId === "appointment-consultation"
    );
    expect(consultation).toMatchObject({
      kind: "consultation",
      recordId: "record-consultation",
      reason: "Control general",
      staffName: "Lina",
    });
    expect(
      response.body.items.filter((item) => item.recordId === "record-consultation")
    ).toHaveLength(1);
  });

  test("classifies legacy grooming and no-show events", async () => {
    const response = await request(app).get("/api/dashboard/pets/pet-1/timeline");

    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ appointmentId: "appointment-grooming", kind: "grooming" }),
        expect.objectContaining({ appointmentId: "appointment-no-show", kind: "no_show" }),
      ])
    );
  });

  test("recognizes images and deworming stored as legacy notes", async () => {
    const response = await request(app).get("/api/dashboard/pets/pet-1/timeline");

    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recordId: "record-note", kind: "image" }),
        expect.objectContaining({ recordId: "record-deworming", kind: "deworming" }),
      ])
    );
  });

  test("returns controls, future appointments and vaccines as next actions", async () => {
    const response = await request(app).get("/api/dashboard/pets/pet-1/timeline");

    expect(response.body.nextActions.map((action) => action.id)).toEqual([
      "appointment-appointment-grooming",
      "vaccine-record-vaccine",
      "next-record-consultation",
    ]);
  });
});
