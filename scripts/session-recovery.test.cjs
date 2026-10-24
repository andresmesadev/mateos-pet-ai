const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const React = require('../frontend/node_modules/react');
const { renderToStaticMarkup } = require('../frontend/node_modules/react-dom/server');
const { NextResponse } = require('../frontend/node_modules/next/server');
function compile(relative) { return ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText; }
const policy = { exports: {} };
vm.runInNewContext(compile('frontend/lib/page-request-policy.ts'), policy);
function proxyFixture({ status = 200, session = { user: { role: 'vet', staffId: 'lina-fixture' } }, unavailable = false } = {}) {
  const requests = [], authenticated = [];
  const context = { exports: {}, URL, Response, fetch: async (...args) => {
    requests.push(args); if (unavailable) throw Error('temporary');
    return status === 200 ? Response.json({ navigation: ['/dashboard'], capabilities: { clinical: true } }) : new Response('', { status });
  }, require: name => {
    if (name === './auth') return { auth: callback => async req => { authenticated.push(req.nextUrl.pathname); return callback(req, {}); } };
    if (name === 'next/server') return { NextResponse };
    if (name === './lib/api') return { apiUrl: value => 'http://fixture.invalid' + value, makeServerHeaders: () => ({ 'X-Internal-Token': 'fixture-only' }) };
    if (name === './lib/page-request-policy') return policy.exports;
    throw Error(name);
  } };
  vm.runInNewContext(compile('frontend/proxy.ts'), context);
  return { requests, authenticated, visit: (url = '/dashboard', method = 'GET') => context.exports.proxy({ method, headers: new Headers(), nextUrl: new URL(url, 'https://app.example.test'), auth: session }, {}) };
}
for (const status of [401, 403]) test('revoked session ' + status + ' reaches a public sign-out screen without granting access', async () => {
  const fixture = proxyFixture({ status }), response = await fixture.visit('/dashboard/pos');
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'https://app.example.test/session-recovery?reason=session');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const recovery = await fixture.visit('/session-recovery?reason=session');
  assert.equal(recovery.headers.get('x-middleware-next'), '1');
  assert.equal(fixture.authenticated.length, 1); assert.equal(fixture.requests.length, 1);
});
test('backend outage offers recovery without treating it as a revoked credential', async () => {
  for (const value of [{ status: 503 }, { unavailable: true }]) {
    const response = await proxyFixture(value).visit('/print/pets/fixture');
    assert.equal(response.headers.get('location'), 'https://app.example.test/session-recovery?reason=unavailable');
  }
});
test('ordinary permissions, unauthenticated redirect and page POST protections remain enforced', async () => {
  const allowed = proxyFixture(); assert.equal((await allowed.visit()).headers.get('x-middleware-next'), '1');
  const guest = proxyFixture({ session: null }), response = await guest.visit('/dashboard/pos');
  assert.equal(new URL(response.headers.get('location')).pathname, '/login'); assert.equal(guest.requests.length, 0);
  const post = proxyFixture(); assert.equal((await post.visit('/session-recovery', 'POST')).status, 405); assert.equal(post.requests.length, 0);
  assert.equal((await post.visit('/api/auth/signout')).headers.get('x-middleware-next'), '1');
});

function recoveryFixture({ fail = false, blockedStorage = false, reason = 'session' } = {}) {
  const calls = [], updates = []; let state = 0;
  const context = { exports: {}, window: { location: { assign: value => calls.push(['navigate', value]) } },
    require: name => {
      if (name === 'react/jsx-runtime') return require('../frontend/node_modules/react/jsx-runtime');
      if (name === 'react') return { ...React, useState: initial => { const slot = state++; return [initial, value => updates.push([slot, value])]; } };
      if (name === 'next-auth/react') return { signOut: async options => { calls.push(['signOut', options]); if (fail) throw Error('unavailable'); } };
      if (name === 'next/navigation') return { useRouter: () => ({ replace: value => calls.push(['navigate', value]) }) };
      if (name === '@/lib/workspace-session') return { workspaceStorage: () => null, clearWorkspaceSession: () => calls.push(['workspace-cleared']) };
      if (name === '@/lib/pos-draft') return { clearSaleDrafts: () => calls.push(['temporary-drafts-cleared']) };
      throw Error(name);
    },
  };
  Object.defineProperty(context, 'sessionStorage', { get() { if (blockedStorage) throw Error('Storage denied'); return {}; } });
  vm.runInNewContext(compile('frontend/components/auth/session-recovery.tsx'), context);
  const tree = context.exports.SessionRecovery({ reason }), nodes = [];
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!React.isValidElement(node)) return; nodes.push(node); visit(node.props.children); }
  visit(tree);
  return { calls, updates, html: renderToStaticMarkup(tree), button: nodes.find(node => node.type === 'button'), fallback: nodes.find(node => node.type === 'form') };
}
test('recovery offers an actual Auth.js sign-out and an official fallback, including blocked storage', async () => {
  for (const blockedStorage of [false, true]) {
    const fixture = recoveryFixture({ blockedStorage });
    assert.match(fixture.html, /Cerrar sesión y volver a entrar/);
    assert.equal(fixture.fallback.props.action, '/api/auth/signout'); assert.equal(fixture.fallback.props.method, 'get');
    assert.match(fixture.html, /name="callbackUrl" value="\/login"/);
    fixture.button.props.onClick(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(fixture.calls.filter(call => call[0] === 'signOut').length, 1);
    assert.equal(fixture.calls.find(call => call[0] === 'signOut')[1].callbackUrl, '/login');
  }
});
test('failed interactive logout leaves the official fallback available and releases the button', async () => {
  const fixture = recoveryFixture({ fail: true }); fixture.button.props.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert(fixture.updates.some(([slot, value]) => slot === 0 && value === false));
  assert(fixture.updates.some(([slot, value]) => slot === 1 && /cierre alternativo/.test(value)));
  assert.ok(fixture.fallback);
});
