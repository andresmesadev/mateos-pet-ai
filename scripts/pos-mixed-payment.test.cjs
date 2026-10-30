const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const React = require('../frontend/node_modules/react');
const { renderToStaticMarkup } = require('../frontend/node_modules/react-dom/server');
const modules = new Map();
function load(name) {
  name = name.replace(/^\.\//, '');
  if (modules.has(name)) return modules.get(name);
  const context = { exports: {}, require: load };
  const source = fs.readFileSync(path.join(__dirname, '../frontend/lib', name + '.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  modules.set(name, context.exports); return context.exports;
}
const { mixedPaymentIssue, cashChange } = load('pos-checkout');
const { summarizeCash, isCashData, filterCash } = load('pos-cash');
const { readDraft } = load('pos-draft');
const { isHistoryTransaction, filterTransactions } = load('pos-history');
const paid = { id: 'mixed', total: 50000, paymentMethod: 'mixed', cashAmount: 30000, transferAmount: 20000, paidAt: new Date().toISOString(), paymentStatus: 'paid', origin: 'manual_pos_sale', status: 'active', items: [], notes: null };

test('mixed payment validates exact sum and computes change only over its cash part', () => {
  assert.equal(mixedPaymentIssue(5000000, '30000', '20000'), null);
  for (const [cash, transfer] of [['', '20000'], ['0', '50000'], ['-1', '50001'], ['30000.001', '20000'], ['30000', '19999'], ['30000', '20001']]) assert.ok(mixedPaymentIssue(5000000, cash, transfer));
  assert.equal(mixedPaymentIssue(30, '0.10', '0.20'), null);
  assert.equal(cashChange(3000000, '50000').change, 20000);
});
test('cash totals count one mixed sale once and retain both method allocations', () => {
  const rows = [paid, { ...paid, id: 'single', total: 10000, paymentMethod: 'cash', cashAmount: null, transferAmount: null }];
  const summaryCash = summarizeCash(rows, new Set());
  assert.equal(summaryCash.methods.cash.cents, 4000000); assert.equal(summaryCash.methods.transfer.cents, 2000000); assert.equal(summaryCash.mixedCount, 1);
  const page = { date: '2026-10-24', scope: 'day', data: rows, transactions: rows, toReview: [], total: 2, page: 1, pageSize: 10, totalPages: 1, summary: { activeCount: 2, voidedCount: 0, activeTotal: 60000 }, summaryCash, totalRegistered: 60000, pendingCount: 0, hasMore: false };
  assert.equal(isCashData(page), true);
  assert.equal(isCashData({ ...page, summaryCash: { ...summaryCash, mixedCount: 0 } }), false);
  assert.equal(filterCash(rows, new Set(), '', 'registered', 'cash').length, 2);
  assert.equal(filterTransactions(rows, '', 'transfer', 'active').length, 1);
  assert.equal(isHistoryTransaction({ ...paid, transferAmount: 1 }), false);
});
test('draft recovery retains split and immutable uncertain operation body', () => {
  const body = JSON.stringify({ paymentMethod: 'mixed', cashAmount: 30000, transferAmount: 20000 });
  const input = { version: 1, scope: 'mixed-scope', updatedAt: Date.now(), stage: 'verify', lines: [], client: null, petId: '', paymentMethod: 'mixed', cashAmount: '30000', transferAmount: '20000', received: '50000', notes: '', operationKey: '12345678-1234-1234-1234-123456789abc', operationBody: body };
  const restored = readDraft(JSON.stringify(input), input.scope);
  assert.equal(restored.cashAmount, '30000'); assert.equal(restored.transferAmount, '20000'); assert.equal(restored.operationBody, body);
});
test('saved mixed receipt prints both real parts without duplicating its total', () => {
  const context = { exports: {}, require: name => {
    if (name === 'react') return React;
    if (name === '@/lib/api') return { proxyUrl: value => value };
    if (name === 'react/jsx-runtime') return require('../frontend/node_modules/react/jsx-runtime');
    if (name === 'react-dom') return { createPortal() {} };
    if (name.startsWith('@/lib/')) return load(name.slice('@/lib/'.length));
    if (name === 'lucide-react' || name.startsWith('@/components/')) return {};
    throw new Error(name);
  } };
  const source = fs.readFileSync(path.join(__dirname, '../frontend/components/dashboard/pos/sale-receipt.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const html = renderToStaticMarkup(React.createElement(context.exports.SaleReceipt, { transaction: paid, cash: { received: 50000, change: 20000 } }));
  assert.match(html, /Parte en efectivo/); assert.match(html, /Parte en transferencia/);
  assert.match(html, /30\.000/); assert.match(html, /20\.000/); assert.equal((html.match(/Total COP/g) ?? []).length, 1);
  const transaction = { ...paid, tenantId: 'own-business' };
  const own = renderToStaticMarkup(React.createElement(context.exports.SaleReceipt, { transaction, establishment: { id: 'own-business', name: 'Tienda propia', contactPhone: 'CONTACT-OWN', address: 'Dirección propia' } }));
  assert.match(own, /Tienda propia/); assert.match(own, /CONTACT-OWN/);
  const wrong = renderToStaticMarkup(React.createElement(context.exports.SaleReceipt, { transaction, establishment: { id: 'other', name: 'FOREIGN-ISSUER', contactPhone: 'FOREIGN-PHONE' } }));
  assert.doesNotMatch(wrong, /FOREIGN-ISSUER|FOREIGN-PHONE/);
});
