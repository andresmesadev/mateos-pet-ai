const express = require("express");
const prisma = require("../lib/prisma");
const {
  createCheckoutSession,
  cancelSubscription,
  updateSubscriptionPrice,
  constructWebhookEvent,
} = require("../services/stripe.service");

// ─── Checkout & status router (needs parsed JSON body) ───────────────────────

const router = express.Router();

/**
 * POST /api/billing/checkout
 * Crea una Checkout Session de Stripe y devuelve la URL de pago.
 * Body: { tenantId, priceId, successUrl, cancelUrl }
 */
router.post("/checkout", async (req, res) => {
  try {
    const { tenantId, priceId, successUrl, cancelUrl } = req.body ?? {};

    if (!tenantId || !priceId || !successUrl || !cancelUrl) {
      return res.status(400).json({
        error: "tenantId, priceId, successUrl y cancelUrl son requeridos",
      });
    }

    const session = await createCheckoutSession(
      tenantId,
      priceId,
      successUrl,
      cancelUrl
    );

    if (!session) {
      return res.status(503).json({
        error: "Stripe no está configurado en este entorno",
      });
    }

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("[Billing] checkout error:", error.message);

    if (error.message === "Tenant not found") {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Entregable 4.4 (Fase 4) — Facturación / Habilitación Comercial.
 * POST /api/billing/cancel
 * Cancela la suscripción activa de un tenant. Conecta stripe.service.cancelSubscription
 * (existente desde antes de este entregable, nunca invocado hasta ahora).
 * Body: { tenantId }
 */
router.post("/cancel", async (req, res) => {
  try {
    const { tenantId } = req.body ?? {};
    if (!tenantId) {
      return res.status(400).json({ error: "tenantId es requerido" });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    if (!tenant.stripeSubscriptionId) {
      return res.status(400).json({ error: "El tenant no tiene una suscripción activa" });
    }

    const subscription = await cancelSubscription(tenant.stripeSubscriptionId);
    if (!subscription) {
      return res.status(503).json({ error: "Stripe no está configurado en este entorno" });
    }

    // Actualización defensiva inmediata — el webhook customer.subscription.deleted
    // llegará también, pero no se depende exclusivamente de su latencia para
    // reflejar la cancelación (mismo principio de Habilitación Comercial: el
    // estado debe quedar correcto sin esperar un evento asíncrono).
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: "canceled",
        active: false,
        planExpiresAt: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
      },
      select: { id: true, plan: true, active: true, subscriptionStatus: true, planExpiresAt: true },
    });

    res.json(updated);
  } catch (error) {
    console.error("[Billing] cancel error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Entregable 4.4 (Fase 4) — Facturación / Habilitación Comercial.
 * POST /api/billing/change-plan
 * Cambia el precio de la suscripción existente de un tenant (Stripe
 * Subscription Item Update), en vez de crear una segunda suscripción vía
 * Checkout — corrige el defecto detectado en la auditoría (cambio de plan
 * pago→pago duplicaba suscripciones activas).
 * Body: { tenantId, priceId }
 */
router.post("/change-plan", async (req, res) => {
  try {
    const { tenantId, priceId } = req.body ?? {};
    if (!tenantId || !priceId) {
      return res.status(400).json({ error: "tenantId y priceId son requeridos" });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    if (!tenant.stripeSubscriptionId) {
      return res.status(400).json({
        error: "El tenant no tiene una suscripción existente — usa /checkout para dar de alta la primera",
      });
    }

    const subscription = await updateSubscriptionPrice(tenant.stripeSubscriptionId, priceId);
    if (!subscription) {
      return res.status(503).json({ error: "Stripe no está configurado en este entorno" });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: subscription.status,
        active: subscription.status === "active" || subscription.status === "trialing",
        planExpiresAt: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
      },
      select: { id: true, plan: true, active: true, subscriptionStatus: true, planExpiresAt: true },
    });

    res.json(updated);
  } catch (error) {
    console.error("[Billing] change-plan error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/billing/status/:tenantId
 * Devuelve el estado de suscripción de un tenant.
 */
router.get("/status/:tenantId", async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        plan: true,
        active: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        planExpiresAt: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    res.json(tenant);
  } catch (error) {
    console.error("[Billing] status error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Stripe webhook handler (needs raw body — registrado en app.js antes de express.json()) ──

/**
 * Procesa eventos de Stripe y actualiza el tenant correspondiente.
 * Se monta directamente en app.js con express.raw() para preservar el body crudo.
 */
const webhookHandler = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  // req.body es un Buffer gracias a express.raw()
  const event = constructWebhookEvent(req.body, signature);

  if (!event) {
    // Stripe no configurado o firma inválida
    return res.status(400).json({ error: "Webhook inválido o Stripe no configurado" });
  }

  try {
    await handleStripeEvent(event);
    res.json({ received: true });
  } catch (error) {
    console.error("[Billing] webhookHandler error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Lógica de eventos ────────────────────────────────────────────────────────

const handleStripeEvent = async (event) => {
  const obj = event.data.object;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const tenantId = obj.metadata?.tenantId;
      if (!tenantId) break;

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          stripeCustomerId: obj.customer,
          stripeSubscriptionId: obj.id,
          subscriptionStatus: obj.status,
          active: obj.status === "active" || obj.status === "trialing",
          planExpiresAt: obj.current_period_end
            ? new Date(obj.current_period_end * 1000)
            : null,
        },
      });

      console.log(
        `[Billing] Subscription ${event.type}: tenant ${tenantId} → ${obj.status}`
      );
      break;
    }

    case "customer.subscription.deleted": {
      const tenantId = obj.metadata?.tenantId;
      if (!tenantId) break;

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: "canceled",
          active: false,
          planExpiresAt: obj.current_period_end
            ? new Date(obj.current_period_end * 1000)
            : null,
        },
      });

      console.log(`[Billing] Subscription deleted: tenant ${tenantId} suspendido`);
      break;
    }

    case "invoice.payment_failed": {
      const customerId = obj.customer;
      if (!customerId) break;

      await prisma.tenant.updateMany({
        where: { stripeCustomerId: customerId },
        data: { subscriptionStatus: "past_due" },
      });

      console.log(`[Billing] Payment failed: customer ${customerId} → past_due`);
      break;
    }

    default:
      console.log(`[Billing] Evento no manejado: ${event.type}`);
  }
};

module.exports = { router, webhookHandler };
