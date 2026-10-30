const { resolveBillingPlanPrice, resolveSubscriptionPlan, BillingPlanPriceError } = require('../billing-plan-price.service');

const configured = { STRIPE_PRICE_ID_BASIC: 'price_basic123', STRIPE_PRICE_ID_PRO: 'price_pro456' };

test.each([['basic', 'price_basic123'], ['pro', 'price_pro456']])('resolves %s exclusively from server configuration', (planId, priceId) => {
  expect(resolveBillingPlanPrice({ planId }, configured)).toEqual({ planId, priceId });
  expect(resolveBillingPlanPrice({ priceId }, configured)).toEqual({ planId, priceId });
  expect(resolveBillingPlanPrice({ planId, priceId }, configured)).toEqual({ planId, priceId });
});

test.each([undefined, null, '', 'STRIPE_PRICE_ID_BASIC', 'NEXT_PUBLIC_STRIPE_PRICE_BASIC', 'prod_basic', 'price_bad/id'])('unavailable or malformed configured price fails closed: %p', value => {
  expect(() => resolveBillingPlanPrice({ planId: 'basic' }, { ...configured, STRIPE_PRICE_ID_BASIC: value })).toThrow(expect.objectContaining({ status: 503 }));
});

test.each([{}, null, [], { planId: null }, { planId: 'free' }, { planId: '__proto__' }, { planId: 'constructor' }, { planId: 'invented' }, { planId: ['basic'] }, { priceId: 'price_unlisted' }, { priceId: '' }, { priceId: 123 }, { priceId: 'NEXT_PUBLIC_STRIPE_PRICE_BASIC' }])('rejects untrusted plan or price input: %p', input => {
  expect(() => resolveBillingPlanPrice(input, configured)).toThrow(expect.objectContaining({ status: 400 }));
});

test('a browser price cannot select a different plan or override the configured one', () => {
  for (const input of [{ planId: 'basic', priceId: configured.STRIPE_PRICE_ID_PRO }, { planId: 'pro', priceId: 'price_attacker' }]) {
    expect(() => resolveBillingPlanPrice(input, configured)).toThrow(expect.objectContaining({ status: 400 }));
  }
});

test('duplicate configured prices fail closed for plan and legacy-price requests', () => {
  const duplicate = { STRIPE_PRICE_ID_BASIC: 'price_shared', STRIPE_PRICE_ID_PRO: 'price_shared' };
  for (const input of [{ planId: 'basic' }, { planId: 'pro' }, { priceId: 'price_shared' }]) {
    expect(() => resolveBillingPlanPrice(input, duplicate)).toThrow(expect.objectContaining({ status: 503 }));
  }
});

test('one unconfigured plan does not disable the independently configured plan', () => {
  expect(resolveBillingPlanPrice({ planId: 'basic' }, { STRIPE_PRICE_ID_BASIC: '  price_basic123  ' })).toEqual({ planId: 'basic', priceId: 'price_basic123' });
  expect(() => resolveBillingPlanPrice({ planId: 'pro' }, { STRIPE_PRICE_ID_BASIC: 'price_basic123' })).toThrow(BillingPlanPriceError);
});

test.each([['basic', 'price_basic123'], ['pro', 'price_pro456']])('maps the provider price to plan %s, ignoring unrelated metadata', (planId, priceId) => {
  for (const price of [priceId, { id: priceId }]) {
    expect(resolveSubscriptionPlan({ metadata: { planId: 'custom' }, items: { data: [{ price }], has_more: false } }, configured)).toEqual({ planId, priceId });
  }
});

test.each([null, {}, { items: { data: [] } }, { items: { data: [{}] } }, { items: { data: [{ price: {} }] } }, { items: { data: [{ price: 'price_unknown' }] } }, { items: { data: [{ price: 'price_basic123' }, { price: 'price_pro456' }] } }, { items: { data: [{ price: 'price_basic123' }], has_more: true } }])('unrecognized or ambiguous provider responses never imply a plan: %p', input => {
  expect(() => resolveSubscriptionPlan(input, configured)).toThrow(expect.objectContaining({ status: 502 }));
});

test('Personalizado cannot be self-purchased or enabled by a client-provided price', () => {
  expect(() => resolveBillingPlanPrice({ planId: 'custom' }, { ...configured, STRIPE_PRICE_ID_CUSTOM: 'price_custom' })).toThrow(expect.objectContaining({ status: 400 }));
  expect(() => resolveBillingPlanPrice({ priceId: 'price_custom' }, { ...configured, STRIPE_PRICE_ID_CUSTOM: 'price_custom' })).toThrow(expect.objectContaining({ status: 400 }));
});
