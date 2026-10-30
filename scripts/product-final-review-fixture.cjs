// Local disposable verification only. Never imported by the application.
const assert = require('node:assert/strict');
module.exports = function install({ prisma }) {
  process.env.WHATSAPP_ENABLED = 'false';
  process.env.WHATSAPP_MULTITENANT_ENABLED = 'false';
  process.env.AI_QUOTA_ENABLED = 'false';
  process.env.OPENAI_API_KEY = 'synthetic-disabled-review';
  process.env.STRIPE_SECRET_KEY = '';
  process.env.STRIPE_PRICE_ID_BASIC = 'price_reviewBasic';
  process.env.STRIPE_PRICE_ID_PRO = 'price_reviewPro';
  process.env.PROVIDER_CREDENTIAL_KEY = Buffer.alloc(32, 8).toString('base64');
  process.env.WHATSAPP_REACTIVATION_TEMPLATES_JSON = '';
  const stripeCalls = [], blockedBrowserRequests = [];
  const stripeFile = require.resolve('../backend/src/services/stripe.service');
  const stripe = {
    createCheckoutSession: async (tenantId, priceId, successUrl) => {
      stripeCalls.push({ action: 'checkout', tenantId, priceId });
      return { id: 'cs_synthetic', url: successUrl };
    },
    createBillingPortalSession: async (customerId, returnUrl) => {
      stripeCalls.push({ action: 'portal', customerId }); return { url: returnUrl };
    },
    cancelSubscription: async id => { stripeCalls.push({ action: 'cancel', id }); return { id, status: 'canceled' }; },
    updateSubscriptionPrice: async (id, priceId) => {
      stripeCalls.push({ action: 'change', id, priceId });
      return { id, status: 'active', items: { data: [{ price: { id: priceId } }] } };
    },
    constructWebhookEvent: () => null,
  };
  require.cache[stripeFile] = { id: stripeFile, filename: stripeFile, loaded: true, exports: stripe };
  const provisioning = require('../backend/src/services/tenant-provisioning.service');
  const original = provisioning.provisionDefaultDigitalEmployees;
  provisioning.provisionDefaultDigitalEmployees = async tenantId => {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    if (tenant?.slug.startsWith('qa-pending-')) return { results: [{ specialization: 'recepcionista', error: 'Synthetic preparation failure' }] };
    return original(tenantId);
  };
  async function guardBrowser(context) {
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (!['http:', 'https:'].includes(url.protocol) || ['localhost', '127.0.0.1'].includes(url.hostname)) return route.continue();
      blockedBrowserRequests.push(url.origin);
      return route.abort('blockedbyclient');
    });
  }
  return { stripeCalls, blockedBrowserRequests, guardBrowser, assertLocalUrl(url) {
    assert.equal(new URL(url).hostname, '127.0.0.1');
  } };
};
