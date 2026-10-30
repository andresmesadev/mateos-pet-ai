const express = require('express');
const request = require('supertest');

jest.mock('../../lib/prisma', () => ({ tenant: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() } }));
jest.mock('../../services/stripe.service', () => ({ createCheckoutSession: jest.fn(), updateSubscriptionPrice: jest.fn(), cancelSubscription: jest.fn(), constructWebhookEvent: jest.fn() }));
const prisma = require('../../lib/prisma');
const stripe = require('../../services/stripe.service');
const { router, webhookHandler } = require('../../routes/billing.routes');
const originalEnv = process.env;

function app() {
  const server = express();
  server.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);
  server.use(express.json());
  server.use('/billing', router);
  return server;
}
function subscription(priceId = 'price_pro456', patch = {}) {
  return { id: 'sub_demo', customer: 'cus_demo', metadata: { tenantId: 'tenant-demo', planId: 'forged-plan' }, status: 'active', current_period_end: 1800000000, items: { data: [{ price: { id: priceId } }], has_more: false }, ...patch };
}
function event(object, type = 'customer.subscription.updated') {
  return { id: 'event_demo', type, data: { object } };
}
async function deliver(providerEvent) {
  stripe.constructWebhookEvent.mockReturnValue(providerEvent);
  return request(app()).post('/webhook').set('stripe-signature', 'synthetic').set('Content-Type', 'application/json').send(Buffer.from('{"synthetic":true}'));
}
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, STRIPE_PRICE_ID_BASIC: 'price_basic123', STRIPE_PRICE_ID_PRO: 'price_pro456' };
  prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-demo', plan: 'free', stripeSubscriptionId: 'sub_demo' });
  prisma.tenant.update.mockImplementation(async ({ data }) => ({ id: 'tenant-demo', ...data }));
  stripe.updateSubscriptionPrice.mockResolvedValue(subscription());
});
afterEach(() => { process.env = originalEnv; });

describe.each(['customer.subscription.created', 'customer.subscription.updated'])('%s', type => {
  test.each([['basic', 'price_basic123'], ['pro', 'price_pro456']])('persists %s from the verified provider price', async (plan, priceId) => {
    expect((await deliver(event(subscription(priceId), type))).status).toBe(200);
    expect(prisma.tenant.update).toHaveBeenCalledWith({ where: { id: 'tenant-demo' }, data: expect.objectContaining({ plan, stripeSubscriptionId: 'sub_demo', stripeCustomerId: 'cus_demo', active: true }) });
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
    expect(stripe.updateSubscriptionPrice).not.toHaveBeenCalled();
  });
});

test.each([['active', true], ['trialing', true], ['incomplete', false], ['past_due', false], ['unpaid', false], ['paused', false]])('persists the contracted plan independently of status %s', async (status, active) => {
  expect((await deliver(event(subscription('price_basic123', { status })))).status).toBe(200);
  expect(prisma.tenant.update.mock.calls[0][0].data).toEqual(expect.objectContaining({ plan: 'basic', subscriptionStatus: status, active }));
});

test('repeated delivery preserves the same values and does not create or modify a subscription', async () => {
  const incoming = event(subscription());
  expect((await deliver(incoming)).status).toBe(200);
  expect((await deliver(incoming)).status).toBe(200);
  expect(prisma.tenant.update.mock.calls[0][0]).toEqual(prisma.tenant.update.mock.calls[1][0]);
  expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  expect(stripe.updateSubscriptionPrice).not.toHaveBeenCalled();
});

test.each([
  subscription('price_unknown'),
  subscription('price_pro456', { items: { data: [] } }),
  subscription('price_pro456', { items: { data: [{ price: { id: 'price_pro456' } }, { price: { id: 'price_basic123' } }] } }),
  subscription('price_pro456', { items: { data: [{ price: { id: 'price_pro456' } }], has_more: true } }),
  subscription('price_pro456', { customer: null }),
  subscription('price_pro456', { status: undefined }),
])('a bad provider payload returns an error without overwriting plan or status', async incoming => {
  const response = await deliver(event(incoming));
  expect(response.status).toBe(500);
  expect(prisma.tenant.update).not.toHaveBeenCalled();
  expect(prisma.tenant.updateMany).not.toHaveBeenCalled();
});

test('invalid signature cannot update a plan', async () => {
  stripe.constructWebhookEvent.mockReturnValue(null);
  const response = await request(app()).post('/webhook').set('Content-Type', 'application/json').send(Buffer.from('{}'));
  expect(response.status).toBe(400);
  expect(prisma.tenant.update).not.toHaveBeenCalled();
});

test('expanded customer identity is stored as its provider identifier', async () => {
  expect((await deliver(event(subscription('price_pro456', { customer: { id: 'cus_expanded' } })))).status).toBe(200);
  expect(prisma.tenant.update.mock.calls[0][0].data.stripeCustomerId).toBe('cus_expanded');
});

test('unrelated provider events do not infer a tenant or rewrite any plan', async () => {
  expect((await deliver(event(subscription('price_pro456', { metadata: {} })))).status).toBe(200);
  expect(prisma.tenant.update).not.toHaveBeenCalled();
});

test('change-plan saves the plan actually confirmed by the provider', async () => {
  const response = await request(app()).post('/billing/change-plan').send({ tenantId: 'tenant-demo', planId: 'pro' });
  expect(response.status).toBe(200);
  expect(response.body.plan).toBe('pro');
  expect(stripe.updateSubscriptionPrice).toHaveBeenCalledWith('sub_demo', 'price_pro456');
  expect(prisma.tenant.update.mock.calls[0][0].data.plan).toBe('pro');
});

test.each([
  subscription('price_basic123'),
  subscription('price_unknown'),
  subscription('price_pro456', { id: 'foreign-subscription' }),
  subscription('price_pro456', { items: { data: [] } }),
  subscription('price_pro456', { status: undefined }),
])('contradictory change responses never overwrite the stored plan', async incoming => {
  stripe.updateSubscriptionPrice.mockResolvedValue(incoming);
  const response = await request(app()).post('/billing/change-plan').send({ tenantId: 'tenant-demo', planId: 'pro' });
  expect(response.status).toBe(502);
  expect(prisma.tenant.update).not.toHaveBeenCalled();
});

test('subscription cancellation disables access without inventing a new contracted plan', async () => {
  expect((await deliver(event(subscription(), 'customer.subscription.deleted'))).status).toBe(200);
  expect(prisma.tenant.updateMany.mock.calls[0][0].where).toEqual({ id: 'tenant-demo', stripeSubscriptionId: 'sub_demo' });
  expect(prisma.tenant.updateMany.mock.calls[0][0].data).toEqual(expect.objectContaining({ active: false, subscriptionStatus: 'canceled' }));
  expect(prisma.tenant.updateMany.mock.calls[0][0].data).not.toHaveProperty('plan');
});

test('a new confirmed subscription replaces a terminal one, and delayed events from the old contract cannot replace it', async () => {
  let current = { id: 'tenant-demo', stripeSubscriptionId: 'sub_old', subscriptionStatus: 'canceled' };
  prisma.tenant.findUnique.mockImplementation(async () => current);
  prisma.tenant.update.mockImplementation(async ({ data }) => { current = { ...current, ...data }; return current; });
  prisma.tenant.updateMany.mockImplementation(async ({ where, data }) => {
    if (where.stripeSubscriptionId !== current.stripeSubscriptionId) return { count: 0 };
    current = { ...current, ...data }; return { count: 1 };
  });
  expect((await deliver(event(subscription('price_pro456', { id: 'sub_new' }), 'customer.subscription.created'))).status).toBe(200);
  expect(current).toMatchObject({ stripeSubscriptionId: 'sub_new', active: true, plan: 'pro' });
  for (const type of ['customer.subscription.updated', 'customer.subscription.deleted']) {
    expect((await deliver(event(subscription('price_basic123', { id: 'sub_old', status: 'canceled' }), type))).status).toBe(200);
    expect(current).toMatchObject({ stripeSubscriptionId: 'sub_new', active: true, plan: 'pro' });
  }
  expect(prisma.tenant.update).toHaveBeenCalledTimes(1);
});
