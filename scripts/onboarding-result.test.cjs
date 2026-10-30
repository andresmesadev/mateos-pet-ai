const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const root = path.join(__dirname, '..');
function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}
const brand = {};
vm.runInNewContext(compile('frontend/lib/product-brand.ts'), { exports: brand });
const resultModule = {};
vm.runInNewContext(compile('frontend/lib/onboarding-result.ts'), {
  exports: resultModule, require: name => { assert.equal(name, './product-brand'); return brand; },
});
const compiledPage = compile('frontend/app/onboarding/page.tsx');
function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return Array.isArray(node) ? node.map(textOf).join(' ') : textOf(node.props?.children);
}
function nodes(node) {
  if (!node || typeof node !== 'object') return [];
  return Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
}

// Execute the real page and handlers with stateful hooks and simulated I/O.
// No browser, database, storage, credentials service or outbound mail is used.
function fixture({ provisioning = 'ready', responseBody, malformed = false, login = { ok: true }, hold = false } = {}) {
  const state = [], refs = [], effects = [], timers = new Map(), exports = {};
  const requests = [], signIns = [], navigation = [], pendingEffects = [];
  let stateCursor, refCursor, effectCursor, dirty = true, tree, timerId = 0, release;
  const gate = hold ? new Promise(resolve => { release = resolve; }) : null;
  const react = {
    useState(initial) {
      const index = stateCursor++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], value => {
        const next = typeof value === 'function' ? value(state[index]) : value;
        if (!Object.is(next, state[index])) { state[index] = next; dirty = true; }
      }];
    },
    useRef(initial) { const index = refCursor++; return refs[index] ||= { current: initial }; },
    useEffect(callback, deps) {
      const index = effectCursor++, previous = effects[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        previous?.cleanup?.(); effects[index] = { deps };
        pendingEffects.push(() => { effects[index].cleanup = callback(); });
      }
    },
  };
  const node = (type, props) => ({ type, props });
  vm.runInNewContext(compiledPage, {
    exports, console, AbortController,
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: node, jsxs: node, Fragment: 'Fragment' };
      if (name === 'next/link') return { default: 'a' };
      if (name === 'next/navigation') return { useRouter: () => ({ replace: url => navigation.push(url), refresh: () => navigation.push('refresh') }) };
      if (name === 'next-auth/react') return { signIn: async (provider, input) => {
        signIns.push({ provider, input });
        if (login instanceof Error) throw login;
        return login;
      } };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => String(key) });
      if (name === '@/components/onboarding/registration-shell') return { RegistrationShell: 'Shell' };
      if (name.endsWith('registration.module.css')) return { default: new Proxy({}, { get: (_, key) => String(key) }) };
      if (name === '@/lib/onboarding-result') return resultModule;
      throw new Error('Unexpected dependency: ' + name);
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.includes('/verify/')) return { ok: true, json: async () => ({ available: true }) };
      assert.equal(url, '/api/onboarding/register');
      if (gate) await gate;
      return { ok: true, status: 201, json: async () => {
        if (malformed) throw new Error('invalid JSON');
        return responseBody === undefined ? { tenant: { slug: 'centro-demo' }, provisioning } : responseBody;
      } };
    },
  });
  function render() { stateCursor = refCursor = effectCursor = 0; dirty = false; tree = exports.default(); }
  async function flush() {
    for (let i = 0; i < 20; i++) {
      if (dirty) render();
      while (pendingEffects.length) pendingEffects.shift()();
      if (!timers.size && !dirty) return;
      const callbacks = [...timers.values()]; timers.clear();
      for (const callback of callbacks) await callback();
    }
    throw new Error('UI did not settle');
  }
  function find(predicate) { const found = nodes(tree).find(predicate); assert.ok(found, 'Element missing'); return found; }
  async function field(id, value) { find(node => node.props?.id === id).props.onChange({ target: { value } }); await flush(); }
  const submit = () => find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  async function prepare(modules = ['veterinary']) {
    await flush(); await field('business-name', 'Centro demo');
    for (const activity of ['veterinary', 'grooming', 'retail']) {
      const checkbox = find(node => node.type === 'input' && node.props.value === activity);
      if (checkbox.props.checked !== modules.includes(activity)) { checkbox.props.onChange({ target: { checked: modules.includes(activity) } }); await flush(); }
    }
    await submit(); await flush();
    await field('owner-name', 'Admin demo'); await field('owner-email', ' ADMIN@EXAMPLE.INVALID ');
    await field('owner-password', 'Password synthetic 123'); await field('confirm-password', 'Password synthetic 123');
    await submit(); await flush();
  }
  return { prepare, submit, flush, release: () => release?.(), requests, signIns, navigation, state,
    get tree() { return tree; }, get text() { return textOf(tree); },
    links: () => nodes(tree).filter(node => node.type === 'a'),
    registrations: () => requests.filter(request => request.url === '/api/onboarding/register'),
  };
}

test('ready registration signs in and preserves the normal welcome route', async () => {
  const f = fixture(); await f.prepare(); await f.submit(); await f.flush();
  assert.deepEqual(f.navigation, ['/onboarding/success', 'refresh']);
  assert.equal(f.registrations().length, 1); assert.equal(f.signIns.length, 1);
  assert.equal(f.signIns[0].input.email, 'admin@example.invalid');
  assert.doesNotMatch(f.text, /quedó pendiente|No pudimos comprobar/);
});

for (const state of ['pending', 'unrecognized', null]) test(`created account with ${state} preparation keeps a visible recovery action`, async () => {
  const f = fixture({ provisioning: state }); await f.prepare(); await f.submit(); await f.flush();
  assert.deepEqual(f.navigation, []);
  assert.match(f.text, /Tu cuenta ya está creada/);
  assert.match(f.text, state === 'pending' ? /quedó pendiente/ : /No pudimos comprobar/);
  assert.match(f.text, /Puedes continuar.*dashboard/);
  assert.match(f.text, /WhatsApp y la habilitación de IA se configuran por separado/);
  assert.ok(f.links().some(link => link.props.href === '/dashboard'));
  const support = f.links().find(link => link.props.href.startsWith('mailto:'));
  assert.ok(support); assert.match(decodeURIComponent(support.props.href), /centro-demo/);
  assert.doesNotMatch(decodeURIComponent(support.props.href), /Password|admin@example|Admin demo/);
  assert.equal(JSON.stringify(f.state).includes('Password synthetic'), false);
  await f.submit(); await f.flush(); assert.equal(f.registrations().length, 1);
});

for (const login of [null, {}, { error: 'CredentialsSignin' }, { ok: false }, new Error('login unavailable')]) {
  for (const provisioning of ['ready', 'pending']) test(`${provisioning} creation survives login result ${JSON.stringify(login)}`, async () => {
    const f = fixture({ provisioning, login }); await f.prepare(); await f.submit(); await f.flush();
    assert.deepEqual(f.navigation, []); assert.equal(f.registrations().length, 1);
    assert.match(f.text, /Inicia sesión con tu correo/);
    assert.ok(f.links().some(link => textOf(link).trim() === 'Iniciar sesión' && link.props.href === '/login'));
    if (provisioning === 'pending') assert.match(f.text, /quedó pendiente/);
    await f.submit(); await f.submit(); await f.flush();
    assert.equal(f.registrations().length, 1); assert.equal(f.signIns.length, 1);
    assert.equal(JSON.stringify(f.state).includes('Password synthetic'), false);
  });
}

test('invalid JSON after HTTP 201 cannot cause a second account registration', async () => {
  const f = fixture({ malformed: true }); await f.prepare(); await f.submit(); await f.flush();
  assert.match(f.text, /No pudimos comprobar/); assert.deepEqual(f.navigation, []);
  await f.submit(); await f.flush(); assert.equal(f.registrations().length, 1);
});

test('the in-flight and confirmed creation guards also protect a stale submit handler', async () => {
  const f = fixture({ hold: true, provisioning: 'pending' }); await f.prepare();
  const first = f.submit(); await f.submit();
  assert.equal(f.registrations().length, 1);
  f.release(); await first;
  // Before a render: handler still sees the old React state.
  await f.submit(); assert.equal(f.registrations().length, 1);
  await f.flush(); assert.match(f.text, /quedó pendiente/);
});

for (let mask = 1; mask < 8; mask++) test(`module selection ${mask} is preserved while reporting partial preparation`, async () => {
  const modules = ['veterinary', 'grooming', 'retail'].filter((_, i) => mask & (1 << i));
  const f = fixture({ provisioning: 'pending' }); await f.prepare(modules); await f.submit(); await f.flush();
  assert.deepEqual(JSON.parse(f.registrations()[0].options.body).activeModules.slice().sort(), modules.slice().sort());
  assert.match(f.text, /quedó pendiente/); assert.deepEqual(f.navigation, []);
});

test('support destination stays fixed and the business identifier cannot inject mail headers', () => {
  const link = resultModule.onboardingSupportHref('demo&cc=evil@example.invalid\r\nBcc:evil');
  assert.ok(link.startsWith('mailto:huellanex@nexoweb.co?subject='));
  assert.equal(link.split('&').length, 2);
  assert.equal(resultModule.onboardingNotice('ready'), null);
});

for (const provisioning of ['ready', 'pending']) test(`public proxy preserves the ${provisioning} contract without forwarding authority`, async () => {
  const proxy = {}, calls = [];
  vm.runInNewContext(compile('frontend/app/api/onboarding/[...path]/route.ts'), {
    exports: proxy, Response, URL, AbortSignal, process: { env: {} },
    require(name) {
      if (name === '@/lib/api') return { apiUrl: path => 'https://backend.example.invalid' + path };
      if (name === '@/lib/operator-channel/admin-auth') return { canonicalAdminEmail: email => email.toLowerCase().trim() };
      throw new Error('Unexpected public proxy dependency: ' + name);
    },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return Response.json({ tenant: { slug: 'centro-demo', plan: 'free' }, provisioning }, { status: 201 });
    },
  });
  const response = await proxy.POST(new Request('https://dashboard.example.invalid/api/onboarding/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json', host: 'dashboard.example.invalid', origin: 'https://dashboard.example.invalid', cookie: 'private=do-not-forward', authorization: 'private', 'x-internal-token': 'private' },
    body: JSON.stringify({ name: 'Centro demo', slug: 'centro-demo', email: 'demo@example.invalid' }),
  }), { params: Promise.resolve({ path: ['register'] }) });
  assert.equal(response.status, 201); assert.equal((await response.json()).provisioning, provisioning);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0].options.headers), ['Content-Type']);
  assert.equal(calls[0].url, 'https://backend.example.invalid/api/onboarding/register');
});
