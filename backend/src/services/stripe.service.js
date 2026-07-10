const Stripe = require("stripe");
const prisma = require("../lib/prisma");

let _stripe = null;

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
};

/**
 * Crea un Customer en Stripe para un tenant.
 * @param {{ id: string, name: string, email?: string|null, slug: string }} tenant
 * @returns {Promise<import('stripe').Stripe.Customer|null>}
 */
const createCustomer = async (tenant) => {
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    return await stripe.customers.create({
      name: tenant.name,
      email: tenant.email || undefined,
      metadata: { tenantId: tenant.id, slug: tenant.slug },
    });
  } catch (error) {
    console.error("[StripeService] createCustomer error:", error.message);
    throw error;
  }
};

/**
 * Crea una suscripción para un customer existente.
 * @returns {Promise<import('stripe').Stripe.Subscription|null>}
 */
const createSubscription = async (customerId, priceId) => {
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    return await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });
  } catch (error) {
    console.error("[StripeService] createSubscription error:", error.message);
    throw error;
  }
};

/**
 * Cancela una suscripción activa.
 * @returns {Promise<import('stripe').Stripe.Subscription|null>}
 */
const cancelSubscription = async (subscriptionId) => {
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    return await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error("[StripeService] cancelSubscription error:", error.message);
    throw error;
  }
};

/**
 * Obtiene el estado de una suscripción.
 * @returns {Promise<import('stripe').Stripe.Subscription|null>}
 */
const getSubscription = async (subscriptionId) => {
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error("[StripeService] getSubscription error:", error.message);
    throw error;
  }
};

/**
 * Crea una Checkout Session de Stripe (pago hosted).
 * El metadata.tenantId se propaga a la suscripción vía subscription_data.
 * @returns {Promise<import('stripe').Stripe.Checkout.Session|null>}
 */
const createCheckoutSession = async (tenantId, priceId, successUrl, cancelUrl) => {
  const stripe = getStripe();
  if (!stripe) return null;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error("Tenant not found");

  const params = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenantId },
    subscription_data: {
      // Propaga tenantId al objeto Subscription para poder encontrar el tenant
      // en los eventos de webhook sin depender del customerId
      metadata: { tenantId },
    },
  };

  if (tenant.stripeCustomerId) {
    params.customer = tenant.stripeCustomerId;
  } else if (tenant.email) {
    params.customer_email = tenant.email;
  }

  try {
    return await stripe.checkout.sessions.create(params);
  } catch (error) {
    console.error("[StripeService] createCheckoutSession error:", error.message);
    throw error;
  }
};

/**
 * Entregable 4.4 (Fase 4) — Facturación / Habilitación Comercial: cambia el
 * precio de una suscripción existente (Stripe Subscription Item Update),
 * en vez de crear una segunda suscripción vía Checkout — corrige el defecto
 * detectado en la auditoría (cambio de plan pago→pago duplicaba
 * suscripciones activas en Stripe).
 * @returns {Promise<import('stripe').Stripe.Subscription|null>}
 */
const updateSubscriptionPrice = async (subscriptionId, newPriceId) => {
  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) throw new Error("Subscription has no items to update");

    return await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: "create_prorations",
    });
  } catch (error) {
    console.error("[StripeService] updateSubscriptionPrice error:", error.message);
    throw error;
  }
};

/**
 * Verifica la firma del webhook y construye el evento Stripe.
 * @param {Buffer} rawBody
 * @param {string} signature  — header stripe-signature
 * @returns {import('stripe').Stripe.Event|null}
 */
const constructWebhookEvent = (rawBody, signature) => {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return null;

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    console.error("[StripeService] constructWebhookEvent error:", error.message);
    return null;
  }
};

module.exports = {
  createCustomer,
  createSubscription,
  cancelSubscription,
  getSubscription,
  createCheckoutSession,
  updateSubscriptionPrice,
  constructWebhookEvent,
};
