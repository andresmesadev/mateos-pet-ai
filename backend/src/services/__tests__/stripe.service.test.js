jest.mock("stripe", () => {
  const instance = {
    customers: { create: jest.fn() },
    subscriptions: { create: jest.fn(), cancel: jest.fn(), retrieve: jest.fn(), update: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
  };
  const ctor = jest.fn(() => instance);
  ctor.__mockInstance = instance;
  return ctor;
});

jest.mock("../../lib/prisma", () => ({
  tenant: { findUnique: jest.fn() },
}));

const Stripe = require("stripe");
const stripeMock = Stripe.__mockInstance;
const prisma = require("../../lib/prisma");

const ORIGINAL_ENV = { ...process.env };

describe("sin STRIPE_SECRET_KEY configurada", () => {
  beforeAll(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  beforeEach(() => jest.clearAllMocks());

  const {
    createCustomer,
    createSubscription,
    cancelSubscription,
    getSubscription,
    createCheckoutSession,
    updateSubscriptionPrice,
    constructWebhookEvent,
  } = require("../stripe.service");

  test("todas las operaciones retornan null sin llamar a Stripe", async () => {
    await expect(createCustomer({ id: "t1", name: "Tenant" })).resolves.toBeNull();
    await expect(createSubscription("cus_1", "price_1")).resolves.toBeNull();
    await expect(cancelSubscription("sub_1")).resolves.toBeNull();
    await expect(getSubscription("sub_1")).resolves.toBeNull();
    await expect(updateSubscriptionPrice("sub_1", "price_2")).resolves.toBeNull();
    expect(constructWebhookEvent(Buffer.from("{}"), "sig")).toBeNull();
    expect(stripeMock.customers.create).not.toHaveBeenCalled();
  });

  test("createCheckoutSession retorna null sin consultar prisma", async () => {
    await expect(
      createCheckoutSession("t1", "price_1", "https://ok", "https://cancel")
    ).resolves.toBeNull();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });
});

describe("con STRIPE_SECRET_KEY configurada", () => {
  let service;

  beforeAll(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    service = require("../stripe.service");
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  beforeEach(() => jest.clearAllMocks());

  test("createCustomer crea el customer en Stripe con metadata del tenant", async () => {
    stripeMock.customers.create.mockResolvedValue({ id: "cus_1" });
    const tenant = { id: "t1", name: "Tenant", slug: "tenant-slug", email: null };
    await expect(service.createCustomer(tenant)).resolves.toEqual({ id: "cus_1" });
    expect(stripeMock.customers.create).toHaveBeenCalledWith({
      name: "Tenant",
      email: undefined,
      metadata: { tenantId: "t1", slug: "tenant-slug" },
    });
  });

  test("createCustomer propaga el error de Stripe", async () => {
    stripeMock.customers.create.mockRejectedValue(new Error("stripe down"));
    await expect(service.createCustomer({ id: "t1", name: "Tenant", slug: "s" })).rejects.toThrow(
      "stripe down"
    );
  });

  test("createSubscription crea la suscripción con el price dado", async () => {
    stripeMock.subscriptions.create.mockResolvedValue({ id: "sub_1" });
    await expect(service.createSubscription("cus_1", "price_1")).resolves.toEqual({ id: "sub_1" });
    expect(stripeMock.subscriptions.create).toHaveBeenCalledWith({
      customer: "cus_1",
      items: [{ price: "price_1" }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });
  });

  test("createSubscription propaga el error de Stripe", async () => {
    stripeMock.subscriptions.create.mockRejectedValue(new Error("stripe down"));
    await expect(service.createSubscription("cus_1", "price_1")).rejects.toThrow("stripe down");
  });

  test("cancelSubscription cancela la suscripción", async () => {
    stripeMock.subscriptions.cancel.mockResolvedValue({ id: "sub_1", status: "canceled" });
    await expect(service.cancelSubscription("sub_1")).resolves.toEqual({
      id: "sub_1",
      status: "canceled",
    });
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith("sub_1");
  });

  test("cancelSubscription propaga el error de Stripe", async () => {
    stripeMock.subscriptions.cancel.mockRejectedValue(new Error("stripe down"));
    await expect(service.cancelSubscription("sub_1")).rejects.toThrow("stripe down");
  });

  test("getSubscription retorna el estado de la suscripción", async () => {
    stripeMock.subscriptions.retrieve.mockResolvedValue({ id: "sub_1", status: "active" });
    await expect(service.getSubscription("sub_1")).resolves.toEqual({
      id: "sub_1",
      status: "active",
    });
  });

  test("getSubscription propaga el error de Stripe", async () => {
    stripeMock.subscriptions.retrieve.mockRejectedValue(new Error("stripe down"));
    await expect(service.getSubscription("sub_1")).rejects.toThrow("stripe down");
  });

  describe("createCheckoutSession", () => {
    test("lanza si el tenant no existe", async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(
        service.createCheckoutSession("t1", "price_1", "https://ok", "https://cancel")
      ).rejects.toThrow("Tenant not found");
    });

    test("usa stripeCustomerId cuando el tenant ya tiene uno", async () => {
      prisma.tenant.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1", email: null });
      stripeMock.checkout.sessions.create.mockResolvedValue({ id: "cs_1" });
      await service.createCheckoutSession("t1", "price_1", "https://ok", "https://cancel");
      const params = stripeMock.checkout.sessions.create.mock.calls[0][0];
      expect(params.customer).toBe("cus_1");
      expect(params.customer_email).toBeUndefined();
    });

    test("usa customer_email cuando no hay stripeCustomerId pero sí email", async () => {
      prisma.tenant.findUnique.mockResolvedValue({ stripeCustomerId: null, email: "a@b.com" });
      stripeMock.checkout.sessions.create.mockResolvedValue({ id: "cs_1" });
      await service.createCheckoutSession("t1", "price_1", "https://ok", "https://cancel");
      const params = stripeMock.checkout.sessions.create.mock.calls[0][0];
      expect(params.customer_email).toBe("a@b.com");
      expect(params.customer).toBeUndefined();
    });

    test("propaga tenantId en metadata y subscription_data.metadata", async () => {
      prisma.tenant.findUnique.mockResolvedValue({ stripeCustomerId: null, email: null });
      stripeMock.checkout.sessions.create.mockResolvedValue({ id: "cs_1" });
      await service.createCheckoutSession("t1", "price_1", "https://ok", "https://cancel");
      const params = stripeMock.checkout.sessions.create.mock.calls[0][0];
      expect(params.metadata).toEqual({ tenantId: "t1" });
      expect(params.subscription_data.metadata).toEqual({ tenantId: "t1" });
    });

    test("propaga el error de Stripe", async () => {
      prisma.tenant.findUnique.mockResolvedValue({ stripeCustomerId: "cus_1" });
      stripeMock.checkout.sessions.create.mockRejectedValue(new Error("stripe down"));
      await expect(
        service.createCheckoutSession("t1", "price_1", "https://ok", "https://cancel")
      ).rejects.toThrow("stripe down");
    });
  });

  describe("updateSubscriptionPrice", () => {
    test("lanza si la suscripción no tiene items", async () => {
      stripeMock.subscriptions.retrieve.mockResolvedValue({ items: { data: [] } });
      await expect(service.updateSubscriptionPrice("sub_1", "price_2")).rejects.toThrow(
        "Subscription has no items to update"
      );
      expect(stripeMock.subscriptions.update).not.toHaveBeenCalled();
    });

    test("actualiza el item existente al nuevo price con proración", async () => {
      stripeMock.subscriptions.retrieve.mockResolvedValue({ items: { data: [{ id: "si_1" }] } });
      stripeMock.subscriptions.update.mockResolvedValue({ id: "sub_1" });
      await service.updateSubscriptionPrice("sub_1", "price_2");
      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith("sub_1", {
        items: [{ id: "si_1", price: "price_2" }],
        proration_behavior: "create_prorations",
      });
    });

    test("propaga el error de Stripe", async () => {
      stripeMock.subscriptions.retrieve.mockRejectedValue(new Error("stripe down"));
      await expect(service.updateSubscriptionPrice("sub_1", "price_2")).rejects.toThrow(
        "stripe down"
      );
    });
  });

  describe("constructWebhookEvent", () => {
    test("retorna null si falta STRIPE_WEBHOOK_SECRET", () => {
      const original = process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_WEBHOOK_SECRET;
      expect(service.constructWebhookEvent(Buffer.from("{}"), "sig")).toBeNull();
      process.env.STRIPE_WEBHOOK_SECRET = original;
    });

    test("construye el evento verificando la firma", () => {
      stripeMock.webhooks.constructEvent.mockReturnValue({ id: "evt_1", type: "invoice.paid" });
      const result = service.constructWebhookEvent(Buffer.from("{}"), "sig_valida");
      expect(result).toEqual({ id: "evt_1", type: "invoice.paid" });
      expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
        Buffer.from("{}"),
        "sig_valida",
        "whsec_123"
      );
    });

    test("retorna null (sin lanzar) si la firma es inválida", () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("invalid signature");
      });
      expect(service.constructWebhookEvent(Buffer.from("{}"), "sig_invalida")).toBeNull();
    });
  });
});
