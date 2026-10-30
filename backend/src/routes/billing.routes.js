const express = require("express");
const prisma = require("../lib/prisma");
const { resolveBillingPlanPrice, resolveSubscriptionPlan, BillingPlanPriceError } = require("../services/billing-plan-price.service");
const {
  createCheckoutSession,
  createBillingPortalSession,
  cancelSubscription,
  updateSubscriptionPrice,
  constructWebhookEvent,
} = require("../services/stripe.service");

// ─── Checkout & status router (needs parsed JSON body) ───────────────────────

const router = express.Router();

/**
 * POST /api/billing/checkout
 * Crea una Checkout Session de Stripe y devuelve la URL de pago.
 * Body: { tenantId, planId, successUrl, cancelUrl }
 * Legacy priceId is accepted only when allowlisted in server configuration.
 */
router.post("/checkout", async (req, res) => {
  try {
    const { tenantId, successUrl, cancelUrl } = req.body ?? {};

    if (!tenantId || !successUrl || !cancelUrl) {
      return res.status(400).json({
        error: "tenantId, successUrl y cancelUrl son requeridos",
      });
    }

    const { priceId } = resolveBillingPlanPrice(req.body);
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { stripeSubscriptionId: true, subscriptionStatus: true } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    if (tenant.stripeSubscriptionId && !["canceled", "incomplete_expired"].includes(tenant.subscriptionStatus)) {
      return res.status(409).json({ error: "Ya existe una suscripción. Gestiona sus pagos o cambia el plan existente." });
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
    if (error instanceof BillingPlanPriceError) return res.status(error.status).json({ error: error.message });
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
router.post("/portal", async (req, res) => {
  try {
    const { tenantId, returnUrl } = req.body ?? {};
    if (!tenantId || typeof returnUrl !== "string") return res.status(400).json({ error: "tenantId y returnUrl son requeridos" });
    let target;
    try { target = new URL(returnUrl); } catch { return res.status(400).json({ error: "URL de retorno no válida" }); }
    if (target.username || target.password || (target.protocol !== "https:" && !(target.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)))) return res.status(400).json({ error: "URL de retorno no válida" });
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { stripeCustomerId: true } });
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    if (!tenant.stripeCustomerId) return res.status(409).json({ error: "Este negocio todavía no tiene un cliente de pagos registrado." });
    const session = await createBillingPortalSession(tenant.stripeCustomerId, target.href);
    if (!session) return res.status(503).json({ error: "Stripe no está configurado en este entorno" });
    return res.json({ url: session.url });
  } catch {
    return res.status(503).json({ error: "No se pudo abrir la gestión de pagos. Reintenta." });
  }
});

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
 * Body: { tenantId, planId }; legacy priceId must be allowlisted server-side.
 */
router.post("/change-plan", async (req, res) => {
  try {
    const { tenantId } = req.body ?? {};
    if (!tenantId) {
      return res.status(400).json({ error: "tenantId es requerido" });
    }
    const selected = resolveBillingPlanPrice(req.body);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    if (!tenant.stripeSubscriptionId) {
      return res.status(400).json({
        error: "El tenant no tiene una suscripción existente — usa /checkout para dar de alta la primera",
      });
    }

    const subscription = await updateSubscriptionPrice(tenant.stripeSubscriptionId, selected.priceId);
    if (!subscription) {
      return res.status(503).json({ error: "Stripe no está configurado en este entorno" });
    }

    const confirmed = resolveSubscriptionPlan(subscription);
    if (confirmed.planId !== selected.planId || subscription.id !== tenant.stripeSubscriptionId || typeof subscription.status !== 'string' || !subscription.status) {
      throw new BillingPlanPriceError(502, 'El proveedor no confirmó el cambio al plan seleccionado.');
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan: confirmed.planId,
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
    if (error instanceof BillingPlanPriceError) return res.status(error.status).json({ error: error.message });
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

      const confirmed = resolveSubscriptionPlan(obj);
      const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      if (typeof tenantId !== 'string' || typeof customerId !== 'string' || !customerId || typeof obj.id !== 'string' || !obj.id || typeof obj.status !== 'string' || !obj.status) {
        throw new BillingPlanPriceError(502, 'No se pudo identificar la suscripción del proveedor.');
      }

      const current = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { stripeSubscriptionId: true, subscriptionStatus: true } });
      if (current?.stripeSubscriptionId && current.stripeSubscriptionId !== obj.id && !["canceled", "incomplete_expired"].includes(current.subscriptionStatus)) break;

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          plan: confirmed.planId,
          stripeCustomerId: customerId,
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
      if (typeof tenantId !== 'string' || typeof obj.id !== 'string' || !obj.id) throw new BillingPlanPriceError(502, 'No se pudo identificar la suscripción cancelada.');

      // A delayed cancellation for the previous contract must not suspend its replacement.
      await prisma.tenant.updateMany({
        where: { id: tenantId, stripeSubscriptionId: obj.id },
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
