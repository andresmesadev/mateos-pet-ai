const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const { resolveBillingPlanPrice, BillingPlanPriceError } = require('../backend/src/services/billing-plan-price.service');
const root = path.join(__dirname, '..');

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
}
const compiledProxy = compile('frontend/app/api/proxy/billing/route.ts');
const requestModule = { exports: {} };
vm.runInNewContext(compile('frontend/lib/billing-plan-request.ts'), { module: requestModule, exports: requestModule.exports });
const { billingPlanRequest } = requestModule.exports;

function fixture({ user = { staffId: 'staff-demo', tenantId: 'tenant-demo', role: 'admin', sessionVersion: 1 }, liveRole = 'admin', configured = { STRIPE_PRICE_ID_BASIC: 'price_basic123', STRIPE_PRICE_ID_PRO: 'price_pro456' } } = {}) {
  const calls = [], provider = [];
  const exports = {};
  const context = { exports, URL, Response, AbortSignal, console, process: { env: { API_URL: 'https://backend.invalid', NEXTAUTH_URL: 'https://dashboard.example.invalid', INTERNAL_API_SECRET: 'review-only' } },
    require: name => {
      if (name === '@/auth') return { auth: async () => user ? { user } : null };
      if (name === 'next/server') return { NextResponse: { json: (value, options) => Response.json(value, options) } };
      if (name === '@/lib/billing-access') return require('./helpers/billing-access.cjs').loadBillingAccess(context.fetch, context.process.env);
      throw new Error('Unexpected dependency: ' + name);
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith('/staff-session')) return Response.json({ role: liveRole });
      const body = JSON.parse(options.body);
      try {
        if (!url.endsWith('/cancel')) provider.push({ tenantId: body.tenantId, ...resolveBillingPlanPrice(body, configured) });
        return Response.json({ url: 'https://checkout.example.invalid/demo', subscriptionStatus: 'active' });
      } catch (error) {
        if (!(error instanceof BillingPlanPriceError)) throw error;
        return Response.json({ error: error.message }, { status: error.status });
      }
    },
  };
  vm.runInNewContext(compiledProxy, context);
  return { calls, provider, post: body => exports.POST({ json: async () => body }), invalidJson: () => exports.POST({ json: async () => { throw new Error('Malformed JSON'); } }) };
}

for (const planId of ['basic', 'pro']) for (const existing of [false, true]) {
  test(`browser plan ${planId}, existing=${existing}: session proxy resolves canonical price without public env`, async () => {
    const request = billingPlanRequest(planId, existing, 'https://dashboard.example.invalid');
    assert.equal(request.planId, planId);
    assert.equal(request.action, existing ? 'change-plan' : 'checkout');
    assert.equal(Object.hasOwn(request, 'priceId'), false);
    if (!existing) assert.equal(request.successUrl, 'https://dashboard.example.invalid/dashboard/billing?success=1');
    const f = fixture();
    assert.equal((await f.post({ ...request, tenantId: 'foreign-tenant' })).status, 200);
    assert.equal(f.provider.length, 1);
    assert.deepEqual(f.provider[0], { tenantId: 'tenant-demo', planId, priceId: planId === 'basic' ? 'price_basic123' : 'price_pro456' });
    assert.equal(f.calls[1].options.headers['X-Internal-Token'], 'review-only');
  });
}

test('unavailable server plan is explained to the browser without a provider call', async () => {
  const f = fixture({ configured: {} });
  const response = await f.post(billingPlanRequest('basic', false, 'https://dashboard.example.invalid'));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /no está disponible/);
  assert.equal(f.provider.length, 0);
});

test('arbitrary and inconsistent prices are rejected after authenticated proxying', async () => {
  for (const input of [{ priceId: 'price_attacker' }, { planId: 'basic', priceId: 'price_pro456' }, { planId: 'constructor' }]) {
    const f = fixture();
    assert.equal((await f.post({ action: 'checkout', ...input })).status, 400);
    assert.equal(f.provider.length, 0);
  }
});

test('anonymous and revoked-role sessions cannot request subscription prices', async () => {
  const anonymous = fixture({ user: null });
  assert.equal((await anonymous.post({ action: 'checkout', planId: 'basic' })).status, 401);
  assert.equal(anonymous.calls.length, 0);
  const changedRole = fixture({ liveRole: 'vet' });
  assert.equal((await changedRole.post({ action: 'change-plan', planId: 'pro' })).status, 403);
  assert.equal(changedRole.calls.length, 1);
  assert.equal(changedRole.provider.length, 0);
});

test('malformed bodies and inherited action names never reach the billing backend', async () => {
  for (const body of [null, [], 'checkout', { action: 'constructor' }, { action: '__proto__' }, { action: ['checkout'] }]) {
    const f = fixture(); assert.equal((await f.post(body)).status, 400); assert.equal(f.calls.length, 1);
  }
  const f = fixture(); assert.equal((await f.invalidJson()).status, 400); assert.equal(f.calls.length, 1);
});

test('cancellation remains available without configuring a new price', async () => {
  const f = fixture({ configured: {} });
  assert.equal((await f.post({ action: 'cancel' })).status, 200);
  assert.equal(f.provider.length, 0);
});

function billingViewFixture({ existing = false, status = 200, billingStatus = {} } = {}) {
  const exports = {}, calls = [], states = [];
  const location = { origin: 'https://dashboard.example.invalid', href: '', reloads: 0, reload() { this.reloads++; } };
  const node = (type, props) => ({ type, props });
  const source = ts.transpileModule(fs.readFileSync(path.join(root, 'frontend/components/dashboard/billing-view.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { exports, window: { location }, console,
    require: name => {
      if (name === 'react/jsx-runtime') return { jsx: node, jsxs: node };
      if (name === 'react') return { useState: initial => [initial, value => states.push(value)] };
      if (name === '@/lib/billing-plan-request') return requestModule.exports;
      if (name.endsWith('/action-confirmation')) return { useActionConfirmation: () => ({ confirm: async () => true, confirmation: null }) };
      if (name.endsWith('/badge')) return { Badge: 'Badge' };
      if (name.endsWith('/button')) return { Button: 'Button' };
      if (name.endsWith('/card')) return { Card: 'Card', CardContent: 'CardContent', CardHeader: 'CardHeader', CardTitle: 'CardTitle' };
      throw new Error('Unexpected UI dependency: ' + name);
    },
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return Response.json(status === 200 ? { url: 'https://checkout.example.invalid/session' } : { error: 'Este plan no está disponible por el momento.' }, { status });
    },
  });
  const tree = exports.BillingView({ status: { id: 'tenant-demo', active: true, stripeCustomerId: null, plan: 'free', stripeSubscriptionId: existing ? 'sub_demo' : null, subscriptionStatus: 'active', planExpiresAt: null, ...billingStatus } });
  function find(element, planId) {
    if (!element) return null;
    if (Array.isArray(element)) { for (const child of element) { const result = find(child, planId); if (result) return result; } return null; }
    if (element.props?.plan?.id === planId && element.props.onUpgrade) return element;
    return find(element.props?.children, planId);
  }
  return { calls, states, location, card: planId => find(tree, planId), tree, upgrade: async planId => { const card = find(tree, planId); assert.ok(card, 'The actual billing view must render the selected plan'); await card.props.onUpgrade(card.props.plan); } };
}

test('actual billing component sends a plan identity through its authenticated proxy', async () => {
  for (const existing of [false, true]) {
    const f = billingViewFixture({ existing });
    await f.upgrade('pro');
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].url, '/api/proxy/billing');
    assert.equal(f.calls[0].body.planId, 'pro');
    assert.equal(f.calls[0].body.action, existing ? 'change-plan' : 'checkout');
    assert.equal(Object.hasOwn(f.calls[0].body, 'priceId'), false);
    assert.equal(existing ? f.location.reloads : f.location.href, existing ? 1 : 'https://checkout.example.invalid/session');
  }
});

test('actual billing component displays an unavailable-plan response without redirecting', async () => {
  const f = billingViewFixture({ status: 503 });
  await f.upgrade('basic');
  assert.ok(f.states.some(value => typeof value === 'string' && value.includes('no está disponible')));
  assert.equal(f.location.href, '');
  assert.equal(f.location.reloads, 0);
});

function textOf(element) {
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  if (Array.isArray(element)) return element.map(textOf).join(' ');
  return element ? textOf(element.props?.children) : '';
}

test('Personalizado is a fourth quote option with no automatic subscription charge', async () => {
  const f = billingViewFixture();
  for (const id of ['free', 'basic', 'pro', 'custom']) assert.ok(f.card(id));
  const card = f.card('custom');
  assert.equal(card.props.plan.name, 'Personalizado');
  assert.equal(card.props.plan.price, 'A convenir');
  assert.equal(card.props.isDowngrade, false);
  const rendered = card.type(card.props);
  assert.match(textOf(rendered), /Cómo acordar este plan/);
  assert.match(textOf(rendered), /cotización/);
  await f.upgrade('custom');
  assert.equal(f.calls.length, 0);
  assert.equal(f.location.href, '');
  assert.equal(f.location.reloads, 0);
});

test('displayed subscription prices remain references pending commercial confirmation', () => {
  const f = billingViewFixture();
  assert.equal(f.card('basic').props.plan.price, '$49.000');
  assert.equal(f.card('pro').props.plan.price, '$89.000');
  assert.match(textOf(f.tree), /Precios de referencia en COP, pendientes de confirmación comercial/);
  assert.doesNotMatch(textOf(f.tree), /precios incluyen IVA/);
});

test('an enabled evaluation account without a subscription is not labeled inactive', () => {
  function findStatus(element) {
    if (!element || typeof element !== 'object') return null;
    if (Array.isArray(element)) return element.map(findStatus).find(Boolean);
    return element.type?.name === 'StatusBadge' ? element : findStatus(element.props?.children);
  }
  for (const [subscriptionStatus, expected] of [[null, 'Sin suscripción'], ['provider_new_status', 'Por confirmar'], ['active', 'Activo'], ['past_due', 'Pago pendiente']]) {
    const f = billingViewFixture({ billingStatus: { active: true, subscriptionStatus } });
    const badge = findStatus(f.tree); assert.ok(badge);
    assert.equal(textOf(badge.type(badge.props)), expected);
  }
});

test('actual plan cards do not sell unimplemented quotas, unlimited use, branches or third-party API', () => {
  const f = billingViewFixture();
  const offer = textOf(f.tree) + ['free','basic','pro','custom'].map(id => {
    const card=f.card(id); return textOf(card.type(card.props));
  }).join(' ');
  assert.doesNotMatch(offer,/50 citas|\b[15] usuarios? staff|ilimitad|múltiples sedes|API de integración|soporte prioritario|más popular|gratis para siempre/i);
  assert.match(offer,/Básico y Pro comparten actualmente las funciones operativas/);
  assert.match(offer,/módulos y de los permisos/);
  assert.match(offer,/historia clínica requiere el módulo Veterinaria/);
  assert.match(offer,/comprobantes.*operativos/);
  assert.match(offer,/facturación electrónica no forma parte/);
});

test('the offer does not pretend that a subscription automatically grants AI or a ready WhatsApp line', () => {
  const f = billingViewFixture();
  const offer = textOf(f.tree) + ['basic','pro'].map(id => textOf(f.card(id).type(f.card(id).props))).join(' ');
  assert.match(offer,/WhatsApp es opcional/);
  assert.match(offer,/cuenta y número propios/);
  assert.match(offer,/cargos directamente a Meta/);
  assert.match(offer,/cambio de plan no asigna automáticamente un cupo de IA/);
  assert.match(offer,/Cupo de IA por confirmar en la oferta/);
  assert.doesNotMatch(offer,/1[.,]?000 créditos|3[.,]?000 créditos|100 créditos/);
  assert.equal(f.calls.length,0);
});

test('the actual quota link preserves the selected establishment and is absent while suspended', () => {
  function links(element) {
    if (!element || typeof element !== 'object') return [];
    if (Array.isArray(element)) return element.flatMap(links);
    return [...(element.type==='a' ? [element] : []),...links(element.props?.children)];
  }
  const active = billingViewFixture({ billingStatus: { id: 'selected-tenant',active: true } });
  const link = links(active.tree).find(n=>/Consultar conexión/.test(textOf(n)));
  assert.equal(link.props.href,'/dashboard/settings/integrations?tenant=selected-tenant');
  const suspended = billingViewFixture({ billingStatus: { active: false } });
  assert.ok(!links(suspended.tree).some(n=>/Consultar conexión/.test(textOf(n))));
  const free = active.card('free'); assert.equal(free.props.plan.id,'free');
  assert.equal(free.props.plan.name,'Evaluación');
});

test('a canceled current paid plan can be contracted again through checkout', async () => {
  for (const subscriptionStatus of ['canceled', 'incomplete_expired']) {
    const f = billingViewFixture({ existing: true, billingStatus: { plan: 'basic', active: false, subscriptionStatus } });
    const card = f.card('basic');
    assert.equal(card.props.canReactivate, true);
    assert.match(textOf(card.type(card.props)), /Volver a contratar/);
    await f.upgrade('basic');
    assert.equal(f.calls[0].body.action, 'checkout');
    assert.equal(f.calls[0].body.tenantId, 'tenant-demo');
    assert.equal(f.location.reloads, 0);
  }
});

test('pending payment opens the billing portal instead of creating a second subscription', async () => {
  const f = billingViewFixture({ existing: true, billingStatus: { plan: 'basic', active: false, subscriptionStatus: 'past_due', stripeCustomerId: 'cus_demo' } });
  function find(element) {
    if (!element) return null;
    if (Array.isArray(element)) { for (const child of element) { const result = find(child); if (result) return result; } return null; }
    if (element.props?.onClick && textOf(element) === 'Gestionar pagos y suscripción') return element;
    return find(element.props?.children);
  }
  assert.equal(f.card('basic').props.canReactivate, false);
  const button = find(f.tree); assert.ok(button); await button.props.onClick();
  assert.equal(f.calls[0].body.action, 'portal');
  assert.equal(f.calls[0].body.tenantId, 'tenant-demo');
  assert.equal(f.location.href, 'https://checkout.example.invalid/session');
});
