const express = require("express");
// These adapter tests isolate business behavior; access policy has its own matrix.
jest.mock("../../services/business-config.service", () => ({ ...jest.requireActual("../../services/business-config.service"), getActiveModules: async () => ["veterinary", "grooming", "retail"] }));
const request = require("supertest");
jest.mock("../../lib/prisma", () => ({
  medicalRecord: { findFirst: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
  medicalRecordRevision: { findMany: jest.fn() },
  user: { findFirst: jest.fn() },
  $transaction: jest.fn(),
}));
const prisma = require("../../lib/prisma");
const routes = require("../../routes/dashboard.routes");
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.tenant = { tenantId: "tenant-a", isSuperAdmin: false }; req.actor = { type: "admin", email: "owner@example.com" }; next(); });
app.use("/api/dashboard", routes);
beforeEach(() => jest.resetAllMocks());
test("revision access requires both pet identity and tenant membership", async () => {
  prisma.medicalRecord.findFirst.mockResolvedValue(null);
  const result = await request(app).get("/api/dashboard/pets/pet-other/records/record-other/revisions");
  expect(result.status).toBe(404);
  expect(prisma.medicalRecord.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "record-other", petId: "pet-other", pet: { owner: { tenantId: "tenant-a" } } } }));
  expect(prisma.medicalRecordRevision.findMany).not.toHaveBeenCalled();
});
test("revisions are returned by descending version only after membership check", async () => {
  prisma.medicalRecord.findFirst.mockResolvedValue({ id: "record-1", version: 2 });
  prisma.medicalRecordRevision.findMany.mockResolvedValue([{ version: 1, before: { diagnosis: "Original" }, after: { diagnosis: "Corregido" } }]);
  const result = await request(app).get("/api/dashboard/pets/pet-1/records/record-1/revisions");
  expect(result.status).toBe(200);
  expect(result.body).toMatchObject({ version: 2, revisions: [{ before: { diagnosis: "Original" } }] });
});
test("generic patch cannot bypass consultation versioning", async () => {
  prisma.medicalRecord.findFirst.mockResolvedValue({ id: "record-1", appointmentId: "appt-1" });
  expect((await request(app).patch("/api/dashboard/pets/pet-1/records/record-1").send({ diagnosis: "Bypass" })).status).toBe(409);
  expect(prisma.medicalRecord.update).not.toHaveBeenCalled();
});
test("linked consultation cannot be deleted through generic record endpoint", async () => {
  prisma.medicalRecord.findFirst.mockResolvedValue({ id: "record-1", appointmentId: "appt-1" });
  expect((await request(app).delete("/api/dashboard/pets/pet-1/records/record-1")).status).toBe(409);
  expect(prisma.medicalRecord.delete).not.toHaveBeenCalled();
});
test("deleting the owner cannot erase clinical consultations", async () => {
  prisma.user.findFirst.mockResolvedValue({ id: "user-1" });
  prisma.medicalRecord.findFirst.mockResolvedValue({ id: "record-1" });
  prisma.$transaction.mockImplementation((fn) => fn({ pet: { findMany: jest.fn().mockResolvedValue([{ id: "pet-1" }]) }, medicalRecord: prisma.medicalRecord }));
  expect((await request(app).delete("/api/dashboard/clients/user-1")).status).toBe(409);
  expect(prisma.medicalRecord.deleteMany).not.toHaveBeenCalled();
});
