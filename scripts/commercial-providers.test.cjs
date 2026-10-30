const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const { NextResponse } = require('../frontend/node_modules/next/server');
const { loadBillingAccess } = require('./helpers/billing-access.cjs');
const root = path.resolve(__dirname,'..');
function load(file,dependencies,globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{ compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source,{ exports, URL, Response, AbortSignal, console, ...globals, require: name => { if (Object.hasOwn(dependencies,name)) return dependencies[name]; throw Error(name); } }); return exports;
}
const admin = { staffId: 'staff-a', tenantId: 'a', role: 'admin', sessionVersion: 2, isSuperAdmin: false };
function fixture({ user = admin, role = 'admin', credentialStatus = 200, origin = 'https://app.example.test' } = {}) {
  const calls = [], session = user ? { user } : null;
  const fetch = async (url,options = {}) => {
    calls.push({ url,options });
    if (url.endsWith('/staff-session')) return Response.json({ role },{ status: credentialStatus });
    return Response.json({ saved: true });
  };
  const env = { API_URL: 'https://backend.invalid', INTERNAL_API_SECRET: 'synthetic', NEXTAUTH_URL: 'https://app.example.test' };
  const api = { apiUrl: p => env.API_URL+p, makeServerHeaders: (s,id) => ({ 'X-Tenant-Id': s?.user.isSuperAdmin ? id : s?.user.tenantId, 'X-Internal-Token': 'synthetic' }) };
  const access = loadBillingAccess(fetch,env);
  const route = load('frontend/app/api/proxy/integrations/route.ts',{ '@/auth': { auth: async () => session }, 'next/server': { NextResponse }, '@/lib/api': api, '@/lib/billing-access': access },{ fetch, process: { env } });
  const req = body => ({ nextUrl: new URL('https://app.example.test/api/proxy/integrations?tenant=b'), headers: new Headers({ origin,'content-type': 'application/json' }), json: async () => body });
  return { calls, post: body => route.POST(req(body)), get: () => route.GET(req()) };
}
test('integration proxy binds an ordinary administrator to its session tenant', async () => {
  const f = fixture(); assert.equal((await f.post({ action: 'start',tenantId: 'b', actor: 'root', monthlyLimit: 100 })).status,200);
  const call = f.calls.find(c => c.url.endsWith('/whatsapp/start')); assert.equal(call.options.headers['X-Tenant-Id'],'a');
  assert.ok(!JSON.parse(call.options.body).tenantId); assert.ok(!JSON.parse(call.options.body).actor);
});

function ui({ platform = false, exhausted = false } = {}) {
  const status = { platformAdministrator: platform, whatsapp: { setup: { ready: false }, connection: null }, ai: { enabled: true, policyReady: true, configured: true, month: '2026-10', limit: 10, used: exhausted ? 10 : 2, reserved: 0, remaining: exhausted ? 0 : 8, exhausted, pending: [] } };
  let index = 0;
  const node = (type,props) => ({ type,props });
  return load('frontend/components/dashboard/provider-integrations.tsx',{
    react: { useState: initial => [index++ === 0 ? status : initial,() => {}], useCallback: fn => fn, useEffect: () => {}, useRef: () => ({ current: null }) },
    'react/jsx-runtime': { jsx: node,jsxs: node }, 'lucide-react': { MessageCircle: 'Icon',Sparkles: 'Icon' }, '@/components/ui/button': { Button: 'Button' }, '@/lib/whatsapp-signup': {},
  }).ProviderIntegrations({ tenantId: 'a' });
}
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree,...nodes(tree.props?.children)]; }
function text(tree) { return typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(text).join(' ') : tree ? text(tree.props?.children) : ''; }
test('ordinary administrators see usage without controls to allocate themselves a quota', () => {
  assert.ok(!nodes(ui()).some(n => n.props?.id === 'monthly-ai-limit'));
  assert.ok(nodes(ui({ platform: true })).some(n => n.props?.id === 'monthly-ai-limit'));
});
test('the UI explains manual continuity and does not offer unconfigured Meta enrollment', () => {
  const tree = ui({ exhausted: true }); assert.match(text(tree),/Cupo agotado/); assert.match(text(tree),/atención manual/);
  const button = nodes(tree).find(n => n.type === 'Button' && text(n) === 'Preparar conexión'); assert.equal(button.props.disabled,true);
});
test('integration proxy rechecks the current role and credential version', async () => {
  for (const options of [{ user: null },{ role: 'vet' },{ credentialStatus: 403 },{ credentialStatus: 503 }]) {
    const f = fixture(options); assert.ok((await f.get()).status >= 400); assert.equal(f.calls.filter(c => c.url.includes('/api/integrations')).length,0);
  }
});
test('CSRF and invalid actions fail before provider operations', async () => {
  const bad = fixture({ origin: 'https://attacker.invalid' }); assert.equal((await bad.post({ action: 'start' })).status,403);
  const f = fixture(); assert.equal((await f.post({ action: '__proto__' })).status,400); assert.equal((await f.post({ action: 'unknown' })).status,400);
});
test('tenant administrators cannot assign or reconcile their own quota', async () => {
  for (const action of ['limit','reconcile']) assert.equal((await fixture().post({ action,tenantId: 'a' })).status,403);
  const f = fixture({ user: { role: 'admin',isSuperAdmin: true,tenantId: null } }); assert.equal((await f.post({ action: 'limit',tenantId: 'b',monthlyLimit: 10 })).status,200);
  assert.equal(f.calls[0].options.headers['X-Tenant-Id'],'b');
});
test('browser signup accepts asset hints only from exact Meta origins and the standard FINISH event', () => {
  const { signupAssets } = load('frontend/lib/whatsapp-signup.ts',{});
  const data = { type: 'WA_EMBEDDED_SIGNUP',event: 'FINISH',data: { waba_id: '100',phone_number_id: '200' } };
  assert.equal(signupAssets('https://www.facebook.com',JSON.stringify(data)).wabaId,'100');
  for (const origin of ['https://www.facebook.com.attacker.invalid','https://attacker.invalid','http://www.facebook.com']) assert.equal(signupAssets(origin,data),null);
  assert.equal(signupAssets('https://www.facebook.com',{ ...data,event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' }),null);
  assert.equal(signupAssets('https://www.facebook.com',{ ...data,data: { waba_id: '100',phone_number_id: '../other' } }),null);
});
