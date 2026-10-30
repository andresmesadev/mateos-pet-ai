const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const { NextResponse } = require('../frontend/node_modules/next/server');
const { loadBillingAccess } = require('./helpers/billing-access.cjs');
const root = path.resolve(__dirname, '..');
const admin = { staffId: 'staff-a', tenantId: 'tenant-a', role: 'admin', sessionVersion: 3, isSuperAdmin: false };
const node = (type, props) => ({ type, props });
function load(file, dependencies, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { exports, URL, Response, AbortSignal, console, ...globals, require: name => {
    if (name === 'react/jsx-runtime') return { jsx: node, jsxs: node };
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw Error('Unexpected dependency: ' + name);
  } });
  return exports;
}
function fixture({ user = admin, currentRole = 'admin', validationStatus = 200, operationalStatus = 402, unavailable = false, billingUnavailable = false, invalidBillingResponse = false } = {}) {
  const calls = [], session = user ? { user } : null;
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/staff-session')) {
      if (unavailable) throw Error('offline');
      return Response.json({ role: currentRole }, { status: validationStatus });
    }
    if (url.endsWith('/access')) return Response.json({ navigation: ['/dashboard'], capabilities: {} }, { status: operationalStatus });
    if (billingUnavailable) throw Error('billing offline');
    if (invalidBillingResponse) return new Response('not JSON');
    if (url.includes('/status/')) return Response.json({ id: 'tenant-a', active: false, plan: 'basic', stripeCustomerId: 'cus_a', stripeSubscriptionId: 'sub_a', subscriptionStatus: 'past_due', planExpiresAt: null });
    return Response.json({ url: 'https://billing.stripe.invalid/session' });
  };
  const env = { API_URL: 'https://backend.invalid', NEXTAUTH_URL: 'https://app.example.test', INTERNAL_API_SECRET: 'fixture-only' };
  const access = loadBillingAccess(fetch, env);
  const api = { apiUrl: p => env.API_URL + p, makeServerHeaders: (s, selected) => ({ 'X-Tenant-Id': s?.user?.isSuperAdmin ? selected : s?.user?.tenantId }) };
  const policy = load('frontend/lib/page-request-policy.ts', {});
  const guard = load('frontend/proxy.ts', {
    './auth': { auth: fn => req => fn(req, {}) }, 'next/server': { NextResponse }, './lib/api': api,
    './lib/page-request-policy': policy, './lib/billing-access': access,
  }, { fetch });
  const billing = load('frontend/app/api/proxy/billing/route.ts', { '@/auth': { auth: async () => session }, 'next/server': { NextResponse }, '@/lib/billing-access': access }, { fetch, process: { env } });
  const request = (pathname, body) => ({ method: 'GET', headers: new Headers(), auth: session, nextUrl: new URL(pathname, env.NEXTAUTH_URL), json: async () => body });
  const page = () => load('frontend/app/dashboard/billing/page.tsx', {
    '@/auth': { auth: async () => session }, '@/lib/api': api, '@/lib/billing-access': access,
    'next/navigation': { redirect: location => { throw Error('REDIRECT:' + location); } },
    'next/link': { default: 'Link' }, 'lucide-react': { CreditCard: 'icon' },
    '@/components/dashboard/page-header': { PageHeader: 'PageHeader' }, '@/components/dashboard/billing-view': { BillingView: 'BillingView' },
  }, { fetch }).default;
  return { calls, access, session, visit: p => guard.proxy(request(p), {}),
    post: body => billing.POST(request('/api/proxy/billing', body)), get: p => billing.GET(request(p ?? '/api/proxy/billing')),
    page: params => page()({ searchParams: Promise.resolve(params ?? {}) }),
  };
}
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]; }
function text(tree) { return typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(text).join(' ') : tree ? text(tree.props?.children) : ''; }

test('suspended administrator reaches billing after current credential verification, without operational permission', async () => {
  const f = fixture();
  const response = await f.visit('/dashboard/pos');
  assert.equal(response.headers.get('location'), 'https://app.example.test/dashboard/billing');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(f.calls.length, 2);
  assert.equal((await f.visit('/dashboard/billing')).headers.get('x-middleware-next'), '1');
  assert.equal(f.calls.filter(c => c.url.endsWith('/access')).length, 1);
});
test('the billing exemption is exact; nested billing paths retain operational checks', async () => {
  const f = fixture(); await f.visit('/dashboard/billing/anything');
  assert(f.calls[0].url.endsWith('/access'));
});
test('non-administrators cannot enter billing or bypass suspension', async () => {
  const f = fixture({ currentRole: 'vet' });
  assert.equal(new URL((await f.visit('/dashboard/billing')).headers.get('location')).pathname, '/dashboard');
  assert.equal(new URL((await f.visit('/dashboard')).headers.get('location')).searchParams.get('reason'), 'suspended');
  assert.equal((await f.post({ action: 'portal' })).status, 403);
  assert.equal((await f.get()).status, 403);
  assert(f.calls.every(c => !c.url.includes('/api/billing/')));
});
for (const validationStatus of [401, 403, 503]) test('billing rejects current validation failure ' + validationStatus, async () => {
  const f = fixture({ validationStatus });
  const response = await f.visit('/dashboard/billing');
  assert.equal(new URL(response.headers.get('location')).searchParams.get('reason'), validationStatus === 503 ? 'unavailable' : 'session');
  assert.equal((await f.post({ action: 'portal' })).status, validationStatus);
  assert.equal((await f.get()).status, validationStatus);
  assert(f.calls.every(c => !c.url.includes('/api/billing/')));
});
test('expired identity, missing version and anonymous sessions never obtain the exception', async () => {
  for (const user of [null, { ...admin, sessionVersion: null }, { ...admin, staffId: null }]) {
    const f = fixture({ user }); assert.notEqual((await f.visit('/dashboard/billing')).headers.get('x-middleware-next'), '1');
    assert([401, 403].includes((await f.post({ action: 'portal' })).status));
    assert.equal(f.calls.length, 0);
  }
});
test('network failure is unavailable, not authorization', async () => {
  const f = fixture({ unavailable: true });
  assert.equal((await f.get()).status, 503);
  assert.equal(new URL((await f.visit('/dashboard/billing')).headers.get('location')).searchParams.get('reason'), 'unavailable');
});
test('current permissions override stale JWT roles in both directions', async () => {
  const f = fixture({ user: { ...admin, role: 'vet' }, currentRole: 'admin' });
  assert.equal((await f.get()).status, 200);
  assert.equal((await fixture({ currentRole: 'vet' }).get()).status, 403);
});
test('portal and status ignore an ordinary account foreign tenant and portal customer/return URL', async () => {
  const f = fixture();
  assert.equal((await f.post({ action: 'portal', tenantId: 'tenant-b', customerId: 'cus_b', returnUrl: 'https://attacker.invalid/' })).status, 200);
  const sent = JSON.parse(f.calls.at(-1).options.body);
  assert.equal(sent.tenantId, 'tenant-a');
  assert.equal(sent.returnUrl, 'https://app.example.test/dashboard/billing');
  assert.equal(f.calls.at(-1).options.headers['X-Internal-Token'], 'fixture-only');
  await f.get('/api/proxy/billing?tenant=tenant-b');
  assert(f.calls.at(-1).url.endsWith('/status/tenant-a'));
  assert(f.calls.filter(c => c.url.endsWith('/staff-session')).every(c => c.options.headers['X-Tenant-Id'] === 'tenant-a'));
});
test('global administrators must select a business and keep it on portal return', async () => {
  const f = fixture({ user: { role: 'admin', isSuperAdmin: true, tenantId: null } });
  assert.equal((await f.post({ action: 'portal' })).status, 403);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.post({ action: 'portal', tenantId: 'tenant-b' })).status, 200);
  const body = JSON.parse(f.calls.at(-1).options.body);
  assert.equal(body.tenantId, 'tenant-b');
  assert.equal(body.returnUrl, 'https://app.example.test/dashboard/billing?tenant=tenant-b');
});

test('checkout redirects are server-owned and preserve the selected global business', async () => {
  const f = fixture({ user: { role: 'admin', isSuperAdmin: true, tenantId: null } });
  await f.post({ action: 'checkout', planId: 'basic', tenantId: 'tenant-b', successUrl: 'https://attacker.invalid', cancelUrl: 'https://attacker.invalid' });
  const body = JSON.parse(f.calls.at(-1).options.body);
  assert.equal(body.successUrl, 'https://app.example.test/dashboard/billing?tenant=tenant-b&success=1');
  assert.equal(body.cancelUrl, 'https://app.example.test/dashboard/billing?tenant=tenant-b&canceled=1');
});
test('billing server page reauthorizes before reading status and never trusts success query as payment', async () => {
  const denied = fixture({ currentRole: 'vet' });
  await assert.rejects(denied.page(), /REDIRECT:\/dashboard/);
  assert(denied.calls.every(c => c.url.endsWith('/staff-session')));
  const f = fixture(); const tree = await f.page({ tenant: 'tenant-b', success: '1' });
  assert(f.calls.at(-1).url.endsWith('/status/tenant-a'));
  assert.match(text(tree), /pendientes de la confirmación/);
  assert.doesNotMatch(text(tree), /Pago exitoso|ha sido activado/);
  assert(nodes(tree).some(n => n.type === 'BillingView'));
});
test('billing frame excludes the operational provider and offers explicit sign-out', () => {
  const Provider = 'OperationalProvider'; let route = '/dashboard/billing';
  const Frame = load('frontend/components/dashboard/dashboard-frame.tsx', {
    react: { Suspense: 'Suspense' }, 'next/link': { default: 'Link' }, 'next/navigation': { usePathname: () => route },
    '@/components/brand/product-brand': { ProductBrand: 'Brand' }, '@/lib/workspace-session': { clearWorkspaceSession() {}, workspaceStorage() {} }, '@/lib/pos-draft': { clearSaleDrafts() {} },
    './dashboard-sidebar': { DashboardSidebar: 'Sidebar' }, './dashboard-topbar': { DashboardTopbar: 'Topbar' }, './breadcrumb-nav': { BreadcrumbNav: 'Breadcrumb' },
    './dashboard-access-provider': { DashboardAccessProvider: Provider }, './operation-help': { OperationHelp: 'Help' }, './dashboard-loading': { DashboardLoading: 'Loading' },
  }).DashboardFrame;
  const billing = nodes(Frame({ children: 'billing' }));
  assert(!billing.some(n => [Provider, 'Sidebar', 'Topbar'].includes(n.type)));
  assert(billing.some(n => n.type === 'form' && n.props.action === '/api/auth/signout'));
  route = '/dashboard'; assert.equal(Frame({ children: 'workspace' }).type, Provider);
});

test('billing backend failures provide retry responses without opening operations or claiming a payment', async () => {
  for (const options of [{ billingUnavailable: true }, { invalidBillingResponse: true }]) {
    const f = fixture(options);
    assert.equal((await f.get()).status, 503);
    assert.equal((await f.post({ action: 'portal' })).status, 503);
    const page = await f.page({ success: '1' });
    assert.match(text(page), /No se pudo consultar la suscripción/);
    assert(!nodes(page).some(n => n.type === 'BillingView'));
  }
});
