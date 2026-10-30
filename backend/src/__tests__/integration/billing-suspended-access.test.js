const express = require('express');
const request = require('supertest');
jest.mock('../../lib/prisma', () => ({ tenant: { findUnique: jest.fn(), update: jest.fn() }, staffCredential: { findUnique: jest.fn(), findFirst: jest.fn() } }));
jest.mock('../../services/staff-credential.service', () => ({ normalizeEmail: value => value, verifyPassword: jest.fn() }));
jest.mock('../../services/stripe.service', () => ({ createCheckoutSession: jest.fn(), createBillingPortalSession: jest.fn(), updateSubscriptionPrice: jest.fn(), cancelSubscription: jest.fn(), constructWebhookEvent: jest.fn() }));
const prisma = require('../../lib/prisma');
const stripe = require('../../services/stripe.service');
const { verifyPassword } = require('../../services/staff-credential.service');
const { requireInternalToken } = require('../../middleware/requireInternalToken');
const { resolveTenant } = require('../../middleware/resolveTenant');
const staffAuth = require('../../routes/staff-auth.routes');
const { router } = require('../../routes/billing.routes');
const originalEnv = process.env;
const headers = { 'X-Internal-Token': 'review-only', 'X-Staff-Id': 'staff-a', 'X-Tenant-Id': 'tenant-a', 'X-Staff-Session-Version': '3' };
let credential, tenant;
function app() {
  const server = express(); server.use(express.json());
  server.use('/api/internal', requireInternalToken, staffAuth);
  server.use('/api/billing', requireInternalToken, router);
  server.use('/api/dashboard', resolveTenant, (req, res) => res.json({ protected: true }));
  return server;
}
beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv, NODE_ENV: 'production', INTERNAL_API_SECRET: 'review-only', STRIPE_PRICE_ID_BASIC: 'price_basic123' };
  delete process.env.SINGLE_TENANT_ID;
  tenant = { id: 'tenant-a', active: false, stripeCustomerId: 'cus_a', stripeSubscriptionId: 'sub_a', subscriptionStatus: 'past_due' };
  credential = { active: true, staffId: 'staff-a', sessionVersion: 3, email: 'admin@example.invalid', passwordHash: 'fake', staff: { active: true, name: 'Admin A', role: 'admin', tenantId: 'tenant-a', tenant } };
  prisma.staffCredential.findUnique.mockImplementation(async () => credential);
  prisma.staffCredential.findFirst.mockImplementation(async ({ where }) => where.staffId === 'staff-a' && where.staff.tenantId === 'tenant-a' && where.sessionVersion === 3 && credential.active && credential.staff.active ? credential : null);
  prisma.tenant.findUnique.mockImplementation(async ({ where }) => where.id === 'tenant-a' ? tenant : null);
  verifyPassword.mockResolvedValue(true);
  stripe.createBillingPortalSession.mockResolvedValue({ url: 'https://billing.example.invalid/portal' });
  stripe.createCheckoutSession.mockResolvedValue({ id: 'cs_a', url: 'https://checkout.example.invalid/new' });
});
afterEach(() => { process.env = originalEnv; });
const login = () => request(app()).post('/api/internal/staff-login').set('X-Internal-Token', 'review-only').send({ email: 'admin@example.invalid', password: 'test-only' });
const post = (action, body = {}) => request(app()).post('/api/billing/' + action).set(headers).send({ tenantId: 'tenant-a', returnUrl: 'https://app.example.invalid/dashboard/billing', ...body });

test.each(['admin', 'vet'])('suspended business administrator (%s professional role) can authenticate without activating business', async role => {
  credential.staff.role = role;
  credential.staff.accessPermissions = role === 'vet' ? ['administration'] : [];
  const response = await login(); expect(response.status).toBe(200); expect(response.body.role).toBe(role);
  expect((await request(app()).get('/api/dashboard/appointments').set(headers)).status).toBe(402);
  expect(prisma.tenant.update).not.toHaveBeenCalled();
});
test.each(['vet', 'groomer', 'receptionist'])('suspended non-admin %s cannot authenticate', async role => {
  credential.staff.role = role; credential.staff.accessPermissions = [];
  expect((await login()).status).toBe(401);
});
test('inactive credentials/staff and incorrect passwords stay rejected for administrators', async () => {
  credential.active = false; expect((await login()).status).toBe(401);
  credential.active = true; credential.staff.active = false; expect((await login()).status).toBe(401);
  credential.staff.active = true; verifyPassword.mockResolvedValue(false); expect((await login()).status).toBe(401);
});
test('private session revalidation binds current identity, version and tenant even while suspended', async () => {
  const get = extra => request(app()).get('/api/internal/staff-session').set({ ...headers, ...extra });
  expect((await get()).body.role).toBe('admin');
  for (const changed of [{ 'X-Tenant-Id': 'tenant-b' }, { 'X-Staff-Session-Version': '2' }, { 'X-Staff-Id': 'staff-b' }]) expect((await get(changed)).status).toBe(403);
  credential.staff.role = 'vet'; expect((await get()).body.role).toBe('vet');
  credential.active = false; expect((await get()).status).toBe(403);
});
test('portal uses persisted customer and makes no activation writes', async () => {
  const response = await post('portal', { customerId: 'cus_foreign' });
  expect(response.status).toBe(200);
  expect(stripe.createBillingPortalSession).toHaveBeenCalledWith('cus_a', 'https://app.example.invalid/dashboard/billing');
  expect(prisma.tenant.update).not.toHaveBeenCalled();
  expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  expect((await request(app()).get('/api/dashboard/inventory').set(headers)).status).toBe(402);
});
test('portal handles missing business/customer, unconfigured provider and provider failures without activation', async () => {
  expect((await post('portal', { tenantId: 'tenant-b' })).status).toBe(404);
  tenant.stripeCustomerId = null; expect((await post('portal')).status).toBe(409);
  expect(stripe.createBillingPortalSession).not.toHaveBeenCalled();
  tenant.stripeCustomerId = 'cus_a'; stripe.createBillingPortalSession.mockResolvedValue(null); expect((await post('portal')).status).toBe(503);
  stripe.createBillingPortalSession.mockRejectedValue(Error('provider private error')); const failed = await post('portal'); expect(failed.status).toBe(503); expect(failed.body.error).not.toContain('private');
  expect(prisma.tenant.update).not.toHaveBeenCalled();
});
test.each(['javascript:alert(1)', 'https://user:secret@app.invalid', 'http://external.invalid', 'invalid'])('portal rejects unsafe return URL %s', async returnUrl => {
  expect((await post('portal', { returnUrl })).status).toBe(400);
  expect(stripe.createBillingPortalSession).not.toHaveBeenCalled();
});
test('portal internal API is not public', async () => {
  expect((await request(app()).post('/api/billing/portal').send({ tenantId: 'tenant-a', returnUrl: 'https://app.invalid' })).status).toBe(401);
  expect(stripe.createBillingPortalSession).not.toHaveBeenCalled();
});
test.each(['active', 'past_due', 'unpaid', 'incomplete', null])('checkout cannot duplicate an existing %s subscription', async subscriptionStatus => {
  tenant.subscriptionStatus = subscriptionStatus;
  expect((await post('checkout', { planId: 'basic', successUrl: 'https://app.invalid/success', cancelUrl: 'https://app.invalid/cancel' })).status).toBe(409);
  expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
});
test.each(['canceled', 'incomplete_expired'])('terminal subscription %s can start a new checkout without immediate activation', async subscriptionStatus => {
  tenant.subscriptionStatus = subscriptionStatus;
  expect((await post('checkout', { planId: 'basic', successUrl: 'https://app.invalid/success', cancelUrl: 'https://app.invalid/cancel' })).status).toBe(200);
  expect(stripe.createCheckoutSession).toHaveBeenCalledTimes(1);
  expect(prisma.tenant.update).not.toHaveBeenCalled();
});
