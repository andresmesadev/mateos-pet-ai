/**
 * API pública, Fase 1 (Ecosistema) — cierre de la deuda A5: verifica que
 * /api/billing/* (montado como en app.js: publicRateLimit + requireInternalToken
 * + billingRouter) rechaza requests sin el X-Internal-Token correcto, cerrando
 * el hueco donde cualquiera podía cancelar/cambiar el plan de un tenant
 * adivinando su id.
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  tenant: { findUnique: jest.fn(), update: jest.fn() },
}));

jest.mock("../../services/stripe.service", () => ({
  createCheckoutSession: jest.fn(),
  cancelSubscription: jest.fn(),
  updateSubscriptionPrice: jest.fn(),
  constructWebhookEvent: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { cancelSubscription } = require("../../services/stripe.service");
const { router: billingRouter } = require("../../routes/billing.routes");
const { requireInternalToken } = require("../../middleware/requireInternalToken");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/billing", requireInternalToken, billingRouter);
  return app;
}

const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, NODE_ENV: "production", INTERNAL_API_SECRET: "s3cr3t" };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("/api/billing/* — gateado por X-Internal-Token (cierre de A5)", () => {
  test("POST /cancel sin X-Internal-Token es rechazado con 401, sin llegar a Stripe", async () => {
    const res = await request(buildApp()).post("/api/billing/cancel").send({ tenantId: "tenant-cualquiera" });
    expect(res.status).toBe(401);
    expect(cancelSubscription).not.toHaveBeenCalled();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  test("POST /cancel con X-Internal-Token incorrecto es rechazado con 401", async () => {
    const res = await request(buildApp())
      .post("/api/billing/cancel")
      .set("X-Internal-Token", "incorrecto")
      .send({ tenantId: "tenant-cualquiera" });
    expect(res.status).toBe(401);
  });

  test("POST /cancel con X-Internal-Token correcto pasa el gate (comportamiento normal preservado)", async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: "tenant-1", stripeSubscriptionId: "sub_123" });
    cancelSubscription.mockResolvedValue({ current_period_end: 1234567890 });
    prisma.tenant.update.mockResolvedValue({ id: "tenant-1", active: false });

    const res = await request(buildApp())
      .post("/api/billing/cancel")
      .set("X-Internal-Token", "s3cr3t")
      .send({ tenantId: "tenant-1" });

    expect(res.status).toBe(200);
    expect(cancelSubscription).toHaveBeenCalled();
  });

  test("GET /status/:tenantId sin X-Internal-Token es rechazado con 401", async () => {
    const res = await request(buildApp()).get("/api/billing/status/tenant-cualquiera");
    expect(res.status).toBe(401);
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });
});
