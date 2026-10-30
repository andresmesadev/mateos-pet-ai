const express = require('express');
const request = require('supertest');

jest.mock('../../lib/prisma', () => ({ tenant: { findUnique: jest.fn(), update: jest.fn() } }));
jest.mock('../../services/stripe.service', () => ({ createCheckoutSession: jest.fn(), updateSubscriptionPrice: jest.fn(), cancelSubscription: jest.fn(), constructWebhookEvent: jest.fn() }));
const prisma = require('../../lib/prisma');
const stripe = require('../../services/stripe.service');
const { router } = require('../../routes/billing.routes');
const { requireInternalToken } = require('../../middleware/requireInternalToken');
const originalEnv = process.env;
const urls = { successUrl: 'https://review.invalid/dashboard/billing?success=1', cancelUrl: 'https://review.invalid/dashboard/billing?canceled=1' };

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/billing', requireInternalToken, router);
  return server;
}
function post(action, body, token = 'review-internal') {
  return request(app()).post(`/api/billing/${action}`).set('X-Internal-Token', token).send({ tenantId: 'tenant-demo', ...urls, ...body });
}
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, NODE_ENV: 'production', INTERNAL_API_SECRET: 'review-internal', STRIPE_PRICE_ID_BASIC: 'price_basic123', STRIPE_PRICE_ID_PRO: 'price_pro456' };
  prisma.tenant.findUnique.mockImplementation(async ({ select }) => ({ id: 'tenant-demo', stripeSubscriptionId: select ? null : 'sub_demo' }));
  prisma.tenant.update.mockResolvedValue({ id: 'tenant-demo', subscriptionStatus: 'active' });
  stripe.createCheckoutSession.mockResolvedValue({ id: 'checkout_demo', url: 'https://checkout.example.invalid/demo' });
  stripe.updateSubscriptionPrice.mockImplementation(async (id, priceId) => ({ id, status: 'active', current_period_end: 1800000000, items: { data: [{ price: { id: priceId } }] } }));
});
afterEach(() => { process.env = originalEnv; });

test.each([['basic', 'price_basic123'], ['pro', 'price_pro456']])('HTTP checkout for %s passes only its configured price to Stripe', async (planId, priceId) => {
  const response = await post('checkout', { planId });
  expect(response.status).toBe(200);
  expect(stripe.createCheckoutSession).toHaveBeenCalledWith('tenant-demo', priceId, urls.successUrl, urls.cancelUrl);
  expect(prisma.tenant.update).not.toHaveBeenCalled();
});

test.each([['basic', 'price_basic123'], ['pro', 'price_pro456']])('HTTP change-plan for %s passes only its configured price to Stripe', async (planId, priceId) => {
  const response = await post('change-plan', { planId });
  expect(response.status).toBe(200);
  expect(stripe.updateSubscriptionPrice).toHaveBeenCalledWith('sub_demo', priceId);
  expect(prisma.tenant.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tenant-demo' }, data: expect.objectContaining({ plan: planId }) }));
  expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
});

test.each(['checkout', 'change-plan'])('%s preserves only allowlisted legacy price requests', async action => {
  expect((await post(action, { priceId: 'price_pro456' })).status).toBe(200);
  expect(stripe.createCheckoutSession.mock.calls.concat(stripe.updateSubscriptionPrice.mock.calls)).toHaveLength(1);
});

describe.each(['checkout', 'change-plan'])('%s fails before Stripe for untrusted input', action => {
  test.each([{ planId: 'unknown' }, { planId: 'free' }, { planId: 'constructor' }, { priceId: 'price_unlisted' }, { priceId: 'NEXT_PUBLIC_STRIPE_PRICE_BASIC' }, { planId: 'basic', priceId: 'price_pro456' }, {}])('rejects %j', async input => {
    const response = await post(action, input);
    expect(response.status).toBe(400);
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
    expect(stripe.updateSubscriptionPrice).not.toHaveBeenCalled();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
  test.each(['', 'NEXT_PUBLIC_STRIPE_PRICE_BASIC'])('unconfigured price returns 503 without calls or leaking configuration: %s', async price => {
    process.env.STRIPE_PRICE_ID_BASIC = price;
    const response = await post(action, { planId: 'basic' });
    expect(response.status).toBe(503);
    expect(response.body.error).toContain('no está disponible');
    expect(JSON.stringify(response.body)).not.toContain('STRIPE_PRICE');
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
    expect(stripe.updateSubscriptionPrice).not.toHaveBeenCalled();
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});

test.each(['checkout', 'change-plan'])('%s remains protected by internal authentication', async action => {
  expect((await post(action, { planId: 'basic' }, 'invalid')).status).toBe(401);
  expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  expect(stripe.updateSubscriptionPrice).not.toHaveBeenCalled();
});
