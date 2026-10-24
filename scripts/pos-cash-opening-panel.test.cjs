const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
const React = require('../frontend/node_modules/react');
const { renderToStaticMarkup } = require('../frontend/node_modules/react-dom/server');
const compile = file => ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const cashContext = { exports: {} };
vm.runInNewContext(compile('frontend/lib/cash-opening.ts'), cashContext);
const source = compile('frontend/components/dashboard/pos/cash-opening-panel.tsx');
const date = '2026-10-24';
const opening = { date, closed: false, opening: { amount: 212000, sourceDailyCloseId: null, updatedAt: '2026-10-24T12:00:00Z' }, suggestion: null, openingCashAmount: null, retainedCashAmount: null };
function panel({ state = opening, amount = '212000', allowed = true, layout = 'checkout', disabled = false } = {}) {
  const requests = [], events = [], updates = [];
  let index = 0;
  const button = ({ variant, ...props }) => React.createElement('button', props);
  const imports = {
    react: { ...React, useEffect() {}, useState(initial) { const slot = index++; return [slot === 0 ? state : slot === 1 ? amount : initial, value => updates.push({ slot, value })]; } },
    'react/jsx-runtime': require('../frontend/node_modules/react/jsx-runtime'),
    '@/components/ui/button': { Button: button }, '@/lib/api': { proxyUrl: value => '/proxy' + value },
    '@/lib/pos-checkout': { formatPosMoney: value => '$ ' + value }, '@/lib/cash-opening': cashContext.exports,
    '../dashboard-access-provider': { useDashboardAccess: () => ({ capabilities: { administration: allowed } }) },
  };
  const context = { exports: {}, require: id => { assert.ok(id in imports, 'Unexpected import ' + id); return imports[id]; },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ ...opening, opening: { ...opening.opening, amount: Number(amount) } }) }; },
    Event: class { constructor(type) { this.type = type; } }, window: { dispatchEvent: event => events.push(event.type) },
  };
  vm.runInNewContext(source, context);
  const tree = context.exports.CashOpeningPanel({ date, tenant: 'tenant-a', layout, disabled });
  const nodes = [];
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!React.isValidElement(node)) return; nodes.push(node); visit(node.props.children); }
  visit(tree);
  return { html: renderToStaticMarkup(tree), requests, events, updates, input: nodes.find(n => n.type === 'input'), button: nodes.find(n => n.type === button), form: nodes.find(n => n.type === 'form') };
}

test('checkout base is visible without nesting a form or adding a sale submit button', () => {
  const view = panel();
  assert.match(view.html, /Dinero base de caja/);
  assert.match(view.html, /24\/10\/2026/);
  assert.match(view.html, /Base guardada: \$ 212000/);
  assert.equal(view.form, undefined);
  assert.equal(view.button.props.type, 'button');
  assert.equal(view.requests.length, 0);
});

test('Enter in checkout base stops propagation and saves only the scoped daily opening', async () => {
  const view = panel({ amount: '213000' });
  let prevented = false, stopped = false;
  view.input.props.onKeyDown({ key: 'Enter', preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(prevented, true); assert.equal(stopped, true);
  assert.equal(view.requests.length, 1);
  assert.match(view.requests[0].url, /cash\/opening\?date=2026-10-24&tenantId=tenant-a$/);
  assert.equal(view.requests[0].options.method, 'PUT');
  assert.deepEqual(JSON.parse(view.requests[0].options.body), { date, amount: 213000 });
  assert.equal(view.events.join(), 'cash-opening-updated');
});

test('Caja diaria retains its standalone form and confirms a valid zero base', async () => {
  const view = panel({ layout: 'full', amount: '0', state: { ...opening, opening: null } });
  assert.ok(view.form);
  assert.equal(view.button.props.type, 'submit');
  await view.form.props.onSubmit({ preventDefault() {} });
  assert.equal(JSON.parse(view.requests[0].options.body).amount, 0);
  assert.equal(view.events.join(), 'cash-opening-updated');
});

test('opening controls retain administration and closed-day restrictions and respect checkout lock', async () => {
  assert.equal(panel({ allowed: false }).html, '');
  const closed = panel({ state: { ...opening, closed: true, openingCashAmount: 212000, retainedCashAmount: 200000 } });
  assert.equal(closed.input, undefined); assert.equal(closed.button, undefined);
  assert.match(closed.html, /Efectivo dejado para la siguiente jornada/);
  const locked = panel({ disabled: true });
  assert.equal(locked.input.props.disabled, true); assert.equal(locked.button.props.disabled, true);
  locked.button.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(locked.requests.length, 0);
  for (const amount of ['', '-1', '1.001']) {
    const invalid = panel({ amount }); invalid.button.props.onClick();
    await new Promise(resolve => setImmediate(resolve)); assert.equal(invalid.requests.length, 0);
  }
});
