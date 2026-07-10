/**
 * Entregable 4.4 — Facturación / Habilitación Comercial del SaaS: verifica
 * POST /api/billing/cancel (conecta stripe.service.cancelSubscription,
 * antes nunca invocado) y POST /api/billing/change-plan (actualiza la
 * suscripción existente en vez de crear una segunda vía Checkout).
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
const { cancelSubscription, updateSubscriptionPrice } = require("../../services/stripe.service");
const { router: billingRouter } = require("../../routes/billing.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/billing", billingRouter);
  return app;
}

const TENANT_WITH_SUB = { id: "tenant-1", stripeSubscriptionId: "sub_123" };
const TENANT_WITHOUT_SUB = { id: "tenant-2", stripeSubscriptionId: null };

beforeEach(() => jest.clearAllMocks());

describe("POST /api/billing/cancel", () => {
  test("cancela la suscripción y actualiza el tenant a inactivo", async () => {
    prisma.tenant.findUnique.mockResolvedValue(TENANT_WITH_SUB);
    cancelSubscription.mockResolvedValue({ current_period_end: 1234567890 });
    prisma.tenant.update.mockResolvedValue({ id: "tenant-1", active: false, subscriptionStatus: "canceled" });

    const res = await request(buildApp()).post("/api/billing/cancel").send({ tenantId: "tenant-1" });

    expect(res.status).toBe(200);
    expect(cancelSubscription).toHaveBeenCalledWith("sub_123");
    expect(prisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tenant-1" },
        data: expect.objectContaining({ subscriptionStatus: "canceled", active: false }),
      })
    );
  });

  test("rechaza si el tenant no tiene suscripción activa", async () => {
    prisma.tenant.findUnique.mockResolvedValue(TENANT_WITHOUT_SUB);

    const res = await request(buildApp()).post("/api/billing/cancel").send({ tenantId: "tenant-2" });

    expect(res.status).toBe(400);
    expect(cancelSubscription).not.toHaveBeenCalled();
  });

  test("404 si el tenant no existe", async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    const res = await request(buildApp()).post("/api/billing/cancel").send({ tenantId: "no-existe" });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/billing/change-plan", () => {
  test("actualiza la suscripción existente en vez de crear una nueva", async () => {
    prisma.tenant.findUnique.mockResolvedValue(TENANT_WITH_SUB);
    updateSubscriptionPrice.mockResolvedValue({ status: "active", current_period_end: 1234567890 });
    prisma.tenant.update.mockResolvedValue({ id: "tenant-1", active: true, subscriptionStatus: "active" });

    const res = await request(buildApp())
      .post("/api/billing/change-plan")
      .send({ tenantId: "tenant-1", priceId: "price_pro" });

    expect(res.status).toBe(200);
    expect(updateSubscriptionPrice).toHaveBeenCalledWith("sub_123", "price_pro");
  });

  test("rechaza si el tenant no tiene suscripción existente (debe usar /checkout)", async () => {
    prisma.tenant.findUnique.mockResolvedValue(TENANT_WITHOUT_SUB);

    const res = await request(buildApp())
      .post("/api/billing/change-plan")
      .send({ tenantId: "tenant-2", priceId: "price_pro" });

    expect(res.status).toBe(400);
    expect(updateSubscriptionPrice).not.toHaveBeenCalled();
  });
});
