const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const source = fs.readFileSync(path.join(__dirname, '../frontend/app/api/proxy/dashboard/[...path]/route.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture({ env = {}, user = { email: 'owner@example.test', tenantId: 'tenant-a' } } = {}) {
  const calls = [];
  class NextResponse extends Response {
    static json(data, init) { return new NextResponse(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json' } }); }
  }
  const context = { exports: {}, URL, AbortSignal, console,
    process: { env: { INTERNAL_API_SECRET: 'disposable-test-secret', API_URL: 'http://backend.example.test', ...env } },
    require: name => {
      if (name === '@/auth') return { auth: async () => user ? { user } : null };
      if (name === 'next/server') return { NextResponse };
      throw new Error('Unexpected import: ' + name);
    },
    fetch: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify({ state: 'resuelta' }), { headers: { 'Content-Type': 'application/json' } }); },
  };
  vm.runInNewContext(compiled, context);
  async function request({ origin = 'https://dashboard.example.test', site = 'same-origin', method = 'POST', nextOrigin = 'http://localhost:3001', query = '' } = {}) {
    const headers = new Headers(); if (origin) headers.set('origin', origin); if (site) headers.set('sec-fetch-site', site);
    const req = { headers, method, signal: new AbortController().signal, nextUrl: new URL(nextOrigin + '/api/proxy/dashboard/operational-assistants' + query), text: async () => '{"requestId":"fixture"}' };
    return context.exports[method](req, { params: Promise.resolve({ path: ['operational-assistants', 'employee', 'requests'] }) });
  }
  return { calls, request };
}

for (const setting of ['AUTH_URL', 'NEXTAUTH_URL']) test(`the configured ${setting} accepts the public origin behind an internal Next hostname`, async () => {
  const f = fixture({ env: { [setting]: 'https://dashboard.example.test' } });
  const response = await f.request();
  assert.equal(response.status, 200); assert.equal(f.calls.length, 1);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(f.calls[0].options.headers['X-Tenant-Id'], 'tenant-a');
});

test('an unrelated origin cannot reach the backend even with same-origin metadata', async () => {
  const f = fixture({ env: { AUTH_URL: 'https://dashboard.example.test' } });
  assert.equal((await f.request({ origin: 'https://unrelated.example.test' })).status, 403);
  assert.equal(f.calls.length, 0);
});

test('cross-site metadata remains forbidden with a matching Origin', async () => {
  const f = fixture({ env: { AUTH_URL: 'https://dashboard.example.test' } });
  assert.equal((await f.request({ site: 'cross-site' })).status, 403);
  assert.equal(f.calls.length, 0);
});

test('invalid public URL fails closed without forwarding credentials', async () => {
  const f = fixture({ env: { AUTH_URL: 'invalid-url' } });
  assert.equal((await f.request()).status, 503); assert.equal(f.calls.length, 0);
});

test('local development uses the request origin when no public URL is configured', async () => {
  const f = fixture();
  assert.equal((await f.request({ origin: 'http://localhost:3001' })).status, 200);
});

test('a browser query cannot replace a regular user tenant', async () => {
  const f = fixture({ env: { AUTH_URL: 'https://dashboard.example.test' } });
  assert.equal((await f.request({ query: '?tenantId=tenant-b' })).status, 200);
  assert.equal(f.calls[0].options.headers['X-Tenant-Id'], 'tenant-a');
});

test('reads retain no-store and an unauthenticated request is never forwarded', async () => {
  const f = fixture(); const response = await f.request({ method: 'GET', origin: null, site: null });
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const unauthenticated = fixture({ user: null });
  assert.equal((await unauthenticated.request()).status, 401); assert.equal(unauthenticated.calls.length, 0);
});
