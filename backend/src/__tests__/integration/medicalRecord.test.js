const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  appointment: { findFirst: jest.fn() },
  medicalRecord: { findUnique: jest.fn(), upsert: jest.fn() },
  staff: { findFirst: jest.fn() },
  pet: { update: jest.fn() },
  $transaction: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const dashboardRoutes = require("../../routes/dashboard.routes");

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

function buildApp(tenant) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.tenant = tenant; next(); });
  app.use("/api/dashboard", dashboardRoutes);
  return app;
}

const appA = buildApp({ isSuperAdmin: false, tenantId: TENANT_A });

const VET_APPT = {
  id: "appt-1",
  tenantId: TENANT_A,
  status: "in_progress",
  petId: "pet-1",
  serviceType: "vet",
  serviceId: null,
  service: null,
  date: new Date("2026-06-17T14:00:00Z"),
  pet: { id: "pet-1", weight: 8.5 },
};

const MEDICAL_RECORD = {
  id: "mr-1",
  appointmentId: "appt-1",
  petId: "pet-1",
  type: "consultation",
  title: "Consulta veterinaria",
  date: new Date("2026-06-17T14:00:00Z"),
  staffId: null,
  staff: null,
  reason: "Revisión general",
  findings: "Todo normal",
  diagnosis: "Sano",
  treatment: null,
  recommendations: "Vacuna en 6 meses",
  weight: 9.2,
  nextControlAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setupTransaction(record) {
  prisma.$transaction.mockImplementation(async (fn) => {
    const tx = {
      medicalRecord: { upsert: jest.fn().mockResolvedValue(record) },
      pet: { update: jest.fn().mockResolvedValue({}) },
    };
    return fn(tx);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── GET ──────────────────────────────────────────────────────

describe("GET /api/dashboard/appointments/:id/medical-record", () => {
  test("returns 404 when appointment not in tenant", async () => {
    prisma.appointment.findFirst.mockResolvedValue(null);
    const res = await request(appA).get("/api/dashboard/appointments/appt-1/medical-record");
    expect(res.status).toBe(404);
  });

  test("returns 404 when no record exists yet", async () => {
    prisma.appointment.findFirst.mockResolvedValue(VET_APPT);
    prisma.medicalRecord.findUnique.mockResolvedValue(null);
    const res = await request(appA).get("/api/dashboard/appointments/appt-1/medical-record");
    expect(res.status).toBe(404);
  });

  test("returns the record when it exists", async () => {
    prisma.appointment.findFirst.mockResolvedValue(VET_APPT);
    prisma.medicalRecord.findUnique.mockResolvedValue(MEDICAL_RECORD);
    const res = await request(appA).get("/api/dashboard/appointments/appt-1/medical-record");
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("Revisión general");
    expect(res.body.weight).toBe(9.2);
  });
});

// ── PUT — ownership ──────────────────────────────────────────

describe("PUT /api/dashboard/appointments/:id/medical-record — ownership", () => {
  test("rejects appointment from another tenant (findFirst returns null)", async () => {
    prisma.appointment.findFirst.mockResolvedValue(null);
    const appB = buildApp({ isSuperAdmin: false, tenantId: TENANT_B });
    const res = await request(appB).put("/api/dashboard/appointments/appt-1/medical-record").send({});
    expect(res.status).toBe(404);
  });

  test("super admin can create record for any tenant", async () => {
    prisma.appointment.findFirst.mockResolvedValue(VET_APPT);
    setupTransaction(MEDICAL_RECORD);
    const superApp = buildApp({ isSuperAdmin: true, tenantId: null });
    const res = await request(superApp)
      .put("/api/dashboard/appointments/appt-1/medical-record")
      .send({ reason: "Chequeo" });
    expect(res.status).toBe(200);
  });
});

// ── PUT — clinical validations ────────────────────────────────

describe("PUT /api/dashboard/appointments/:id/medical-record — clinical rules", () => {
  test("422 when appointment has no petId", async () => {
    prisma.appointment.findFirst.mockResolvedValue({ ...VET_APPT, petId: null, pet: null });
    const res = await request(appA).put("/api/dashboard/appointments/appt-1/medical-record").send({});
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/mascota/);
  });

  test.each(["cancelled", "no_show"])(
    "422 for status=%s",
    async (status) => {
      prisma.appointment.findFirst.mockResolvedValue({ ...VET_APPT, status });
      const res = await request(appA).put("/api/dashboard/appointments/appt-1/medical-record").send({});
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(status);
    }
  );

  test("422 when service is grooming category", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      ...VET_APPT,
      serviceId: "svc-groom",
      service: { category: "grooming" },
    });
    const res = await request(appA).put("/api/dashboard/appointments/appt-1/medical-record").send({});
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/veterinaria/i);
  });

  test("422 when serviceType suggests grooming and no serviceId", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      ...VET_APPT,
      serviceId: null,
      service: null,
      serviceType: "grooming",
    });
    const res = await request(appA).put("/api/dashboard/appointments/appt-1/medical-record").send({});
    expect(res.status).toBe(422);
  });

  test("allows in_progress vet appointment", async () => {
    prisma.appointment.findFirst.mockResolvedValue(VET_APPT);
    setupTransaction(MEDICAL_RECORD);
    const res = await request(appA).put("/api/dashboard/appointments/appt-1/medical-record")
      .send({ reason: "Control" });
    expect(res.status).toBe(200);
  });

  test("allows completed vet appointment", async () => {
    prisma.appointment.findFirst.mockResolvedValue({ ...VET_APPT, status: "completed" });
    setupTransaction(MEDICAL_RECORD);
    const res = await request(appA).put("/api/dashboard/appointments/appt-1/medical-record")
      .send({ reason: "Control" });
    expect(res.status).toBe(200);
  });

  test("allows vet appointment linked to veterinary service category", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      ...VET_APPT,
      serviceId: "svc-vet",
      service: { category: "veterinary" },
    });
    setupTransaction(MEDICAL_RECORD);
    const res = await request(appA).put("/api/dashboard/appointments/appt-1/medical-record")
      .send({ diagnosis: "Sano" });
    expect(res.status).toBe(200);
  });
});

// ── PUT — staff tenant isolation ──────────────────────────────

describe("PUT /api/dashboard/appointments/:id/medical-record — staff isolation", () => {
  beforeEach(() => {
    prisma.appointment.findFirst.mockResolvedValue(VET_APPT);
  });

  test("404 when staffId belongs to different tenant", async () => {
    prisma.staff.findFirst.mockResolvedValue(null);
    const res = await request(appA)
      .put("/api/dashboard/appointments/appt-1/medical-record")
      .send({ staffId: "staff-other" });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Profesional/);
  });

  test("200 when staffId belongs to same tenant", async () => {
    prisma.staff.findFirst.mockResolvedValue({ id: "staff-1", tenantId: TENANT_A, name: "Dr. Mesa" });
    setupTransaction({ ...MEDICAL_RECORD, staffId: "staff-1", staff: { name: "Dr. Mesa" } });
    const res = await request(appA)
      .put("/api/dashboard/appointments/appt-1/medical-record")
      .send({ staffId: "staff-1" });
    expect(res.status).toBe(200);
    expect(res.body.staffName).toBe("Dr. Mesa");
  });
});

// ── PUT — weight handling ─────────────────────────────────────

describe("PUT /api/dashboard/appointments/:id/medical-record — weight", () => {
  beforeEach(() => {
    prisma.appointment.findFirst.mockResolvedValue(VET_APPT);
  });

  test("updates Pet.weight in the same transaction", async () => {
    let petUpdateCalled = false;
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        medicalRecord: { upsert: jest.fn().mockResolvedValue(MEDICAL_RECORD) },
        pet: {
          update: jest.fn().mockImplementation(async ({ data }) => {
            if (data.weight !== undefined) petUpdateCalled = true;
            return {};
          }),
        },
      };
      return fn(tx);
    });

    const res = await request(appA)
      .put("/api/dashboard/appointments/appt-1/medical-record")
      .send({ weight: 9.2 });

    expect(res.status).toBe(200);
    expect(petUpdateCalled).toBe(true);
  });

  test("does NOT update Pet.weight when weight not provided", async () => {
    let petUpdateCalled = false;
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        medicalRecord: { upsert: jest.fn().mockResolvedValue(MEDICAL_RECORD) },
        pet: {
          update: jest.fn().mockImplementation(async () => {
            petUpdateCalled = true;
            return {};
          }),
        },
      };
      return fn(tx);
    });

    await request(appA)
      .put("/api/dashboard/appointments/appt-1/medical-record")
      .send({ diagnosis: "Sano" }); // no weight

    expect(petUpdateCalled).toBe(false);
  });

  test("historical weight stored in MedicalRecord independently", async () => {
    let upsertData;
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        medicalRecord: {
          upsert: jest.fn().mockImplementation(async ({ create }) => {
            upsertData = create;
            return { ...MEDICAL_RECORD, weight: create.weight };
          }),
        },
        pet: { update: jest.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    await request(appA)
      .put("/api/dashboard/appointments/appt-1/medical-record")
      .send({ weight: 10.5 });

    expect(upsertData.weight).toBe(10.5);
  });
});

// ── PUT — upsert (no duplicates) ──────────────────────────────

describe("PUT /api/dashboard/appointments/:id/medical-record — upsert", () => {
  test("calling PUT twice updates existing record, does not create a second one", async () => {
    prisma.appointment.findFirst.mockResolvedValue(VET_APPT);
    const upsertMock = jest.fn().mockResolvedValue({ ...MEDICAL_RECORD, diagnosis: "Actualizado" });
    prisma.$transaction.mockImplementation(async (fn) => {
      return fn({ medicalRecord: { upsert: upsertMock }, pet: { update: jest.fn() } });
    });

    await request(appA).put("/api/dashboard/appointments/appt-1/medical-record").send({ diagnosis: "Primera vez" });
    await request(appA).put("/api/dashboard/appointments/appt-1/medical-record").send({ diagnosis: "Actualizado" });

    // upsert should have been called twice (idempotent by appointmentId)
    expect(upsertMock).toHaveBeenCalledTimes(2);
    // Both calls used appointmentId as the unique key
    expect(upsertMock.mock.calls[0][0].where).toEqual({ appointmentId: "appt-1" });
    expect(upsertMock.mock.calls[1][0].where).toEqual({ appointmentId: "appt-1" });
  });
});
