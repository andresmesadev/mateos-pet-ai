/**
 * Entregable 4.2 — Onboarding Autónomo: verifica que POST /api/onboarding/register
 * aprovisiona los Empleados Digitales base del tenant recién creado, y que un
 * fallo de aprovisionamiento no revierte ni interrumpe el registro (aislamiento
 * de fallos, mismo principio de 3.3/3.4/3.5).
 */
const express = require("express");
const request = require("supertest");

jest.mock("../../lib/prisma", () => ({
  tenant: { update: jest.fn(), findUnique: jest.fn() },
}));

jest.mock("../../services/tenant.service", () => ({
  createTenant: jest.fn(),
}));

jest.mock("../../services/stripe.service", () => ({
  createCheckoutSession: jest.fn(),
}));

jest.mock("../../services/tenant-provisioning.service", () => ({
  provisionDefaultDigitalEmployees: jest.fn(),
}));

const prisma = require("../../lib/prisma");
const { createTenant } = require("../../services/tenant.service");
const { createCheckoutSession } = require("../../services/stripe.service");
const { provisionDefaultDigitalEmployees } = require("../../services/tenant-provisioning.service");
const onboardingRoutes = require("../../routes/onboarding.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/onboarding", onboardingRoutes);
  return app;
}

const TENANT = { id: "tenant-1", name: "Clínica X", slug: "clinica-x", phone: "573000000000", plan: "free" };

beforeEach(() => {
  jest.clearAllMocks();
  createTenant.mockResolvedValue(TENANT);
  prisma.tenant.update.mockResolvedValue(TENANT);
  prisma.tenant.findUnique.mockResolvedValue(TENANT);
});

describe("POST /api/onboarding/register — aprovisionamiento (Entregable 4.2)", () => {
  test("aprovisiona los Empleados Digitales base del tenant recién creado", async () => {
    provisionDefaultDigitalEmployees.mockResolvedValue({
      results: [
        { specialization: "recepcionista", created: true, digitalEmployeeId: "de-1" },
        { specialization: "coordinador_agenda", created: true, digitalEmployeeId: "de-2" },
      ],
    });

    const res = await request(buildApp())
      .post("/api/onboarding/register")
      .send({ name: "Clínica X", slug: "clinica-x", phone: "573000000000" });

    expect(res.status).toBe(201);
    expect(provisionDefaultDigitalEmployees).toHaveBeenCalledWith(TENANT.id);
    expect(res.body.provisioning.results).toHaveLength(2);
  });

  test("un fallo de aprovisionamiento no revierte el registro: responde 201 con el error reflejado", async () => {
    provisionDefaultDigitalEmployees.mockRejectedValue(new Error("fallo inesperado"));

    const res = await request(buildApp())
      .post("/api/onboarding/register")
      .send({ name: "Clínica X", slug: "clinica-x", phone: "573000000000" });

    expect(res.status).toBe(201);
    expect(res.body.tenant).toBeDefined();
    expect(res.body.provisioning.error).toBe("fallo inesperado");
  });

  test("plan gratuito: aprovisiona pero no inicia checkout de Stripe", async () => {
    provisionDefaultDigitalEmployees.mockResolvedValue({ results: [] });

    const res = await request(buildApp())
      .post("/api/onboarding/register")
      .send({ name: "Clínica X", slug: "clinica-x", phone: "573000000000", plan: "free" });

    expect(res.status).toBe(201);
    expect(provisionDefaultDigitalEmployees).toHaveBeenCalledWith(TENANT.id);
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(res.body.checkoutUrl).toBeNull();
  });

  test("plan pago: aprovisiona Y además inicia checkout de Stripe", async () => {
    const originalPriceId = process.env.STRIPE_PRICE_ID_BASIC;
    process.env.STRIPE_PRICE_ID_BASIC = "price_basic_123";
    provisionDefaultDigitalEmployees.mockResolvedValue({ results: [] });
    createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.com/session-1", id: "sess-1" });

    const res = await request(buildApp())
      .post("/api/onboarding/register")
      .send({ name: "Clínica X", slug: "clinica-x", phone: "573000000000", plan: "basic" });

    expect(res.status).toBe(201);
    expect(provisionDefaultDigitalEmployees).toHaveBeenCalledWith(TENANT.id);
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(res.body.checkoutUrl).toBe("https://checkout.stripe.com/session-1");

    process.env.STRIPE_PRICE_ID_BASIC = originalPriceId;
  });
});
