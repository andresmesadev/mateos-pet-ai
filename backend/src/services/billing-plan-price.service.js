// Subscription provider IDs belong to server configuration, never the browser.
// This adapter does not calculate operational service/pet prices.
const PLAN_PRICE_VARIABLES = Object.freeze({
  basic: 'STRIPE_PRICE_ID_BASIC',
  pro: 'STRIPE_PRICE_ID_PRO',
});
const PRICE_ID = /^price_[A-Za-z0-9]+$/;

class BillingPlanPriceError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'BillingPlanPriceError';
    this.status = status;
  }
}

function resolveBillingPlanPrice(input = {}, env = process.env) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BillingPlanPriceError(400, 'Selecciona un plan de suscripción válido.');
  }
  const { planId, priceId } = input;
  const hasPlan = planId !== undefined;
  const hasPrice = priceId !== undefined;
  if (hasPlan && (typeof planId !== 'string' || !Object.hasOwn(PLAN_PRICE_VARIABLES, planId))) {
    throw new BillingPlanPriceError(400, 'Selecciona Básico o Pro para contratar una suscripción.');
  }
  if (hasPrice && (typeof priceId !== 'string' || !PRICE_ID.test(priceId))) {
    throw new BillingPlanPriceError(400, 'El precio de suscripción solicitado no está permitido.');
  }
  if (!hasPlan && !hasPrice) {
    throw new BillingPlanPriceError(400, 'Selecciona un plan de suscripción.');
  }

  const configured = Object.entries(PLAN_PRICE_VARIABLES).map(([id, key]) => ({
    planId: id,
    priceId: typeof env[key] === 'string' ? env[key].trim() : '',
  }));
  const selected = hasPlan
    ? configured.find(plan => plan.planId === planId)
    : configured.find(plan => plan.priceId === priceId && PRICE_ID.test(plan.priceId));
  if (!selected) {
    throw new BillingPlanPriceError(400, 'El precio de suscripción solicitado no está permitido.');
  }
  if (!PRICE_ID.test(selected.priceId) || configured.some(plan => plan.planId !== selected.planId && plan.priceId === selected.priceId)) {
    throw new BillingPlanPriceError(503, 'Este plan no está disponible por el momento. Contacta con soporte.');
  }
  if (hasPrice && selected.priceId !== priceId) {
    throw new BillingPlanPriceError(400, 'El precio no corresponde al plan seleccionado.');
  }
  return { planId: selected.planId, priceId: selected.priceId };
}

function resolveSubscriptionPlan(subscription, env = process.env) {
  const items = subscription?.items?.data;
  if (!Array.isArray(items) || items.length !== 1 || subscription.items.has_more === true) {
    throw new BillingPlanPriceError(502, 'No se pudo comprobar el plan confirmado por el proveedor.');
  }
  const price = items[0]?.price;
  const priceId = typeof price === 'string' ? price : price?.id;
  if (typeof priceId !== 'string' || !PRICE_ID.test(priceId)) {
    throw new BillingPlanPriceError(502, 'No se pudo comprobar el precio confirmado por el proveedor.');
  }
  try {
    return resolveBillingPlanPrice({ priceId }, env);
  } catch (error) {
    if (error instanceof BillingPlanPriceError && error.status === 400) {
      throw new BillingPlanPriceError(502, 'El proveedor confirmó un precio de suscripción no reconocido.');
    }
    throw error;
  }
}

module.exports = { resolveBillingPlanPrice, resolveSubscriptionPlan, BillingPlanPriceError };
