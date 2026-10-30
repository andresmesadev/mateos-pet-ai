jest.mock('stripe', () => {
  const portal = jest.fn(); const constructor = jest.fn(() => ({ billingPortal: { sessions: { create: portal } } }));
  constructor.portal = portal; return constructor;
});
jest.mock('../../lib/prisma', () => ({}));
const Stripe = require('stripe');
const { createBillingPortalSession } = require('../stripe.service');
const originalKey = process.env.STRIPE_SECRET_KEY;
afterEach(() => { if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = originalKey; jest.clearAllMocks(); });
test('portal is unavailable without key and never calls Stripe', async () => {
  delete process.env.STRIPE_SECRET_KEY;
  await expect(createBillingPortalSession('cus_a', 'https://app.invalid/billing')).resolves.toBeNull();
  expect(Stripe.portal).not.toHaveBeenCalled();
});
test('configured portal invokes the provider with the resolved customer and return URL', async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture';
  Stripe.portal.mockResolvedValue({ url: 'https://billing.invalid/session' });
  await expect(createBillingPortalSession('cus_a', 'https://app.invalid/billing')).resolves.toEqual({ url: 'https://billing.invalid/session' });
  expect(Stripe.portal).toHaveBeenCalledWith({ customer: 'cus_a', return_url: 'https://app.invalid/billing' });
});
