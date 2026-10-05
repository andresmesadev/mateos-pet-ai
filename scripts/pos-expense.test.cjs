const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
function load(name, imports = {}) {
  const context = { exports: {}, require: name => imports[name] };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../frontend/lib/' + name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.exports;
}
const { expenseAmountError, matchesExpense, isExpenseRecord, readPendingExpense, pendingExpenseKey } = load('pos-expense', { './pos-checkout': load('pos-checkout') });
const { filterExpenses, expenseFormDirty, isExpenseHistoryRow } = load('expense-history');
const command = { category: 'supplies', description: 'Champú', responsible: 'Ana', amount: 12500.29, paymentMethod: 'transfer', notes: 'Factura 123', date: '2026-10-03T15:12:01.123Z' };
const row = { ...command, id: 'expense-a', status: 'active', createdAt: command.date, voidReason: null, voidedAt: null };

test('Egresos aceptan centavos con ambas marcas y rechazan importes ambiguos o fuera del esquema', () => {
  for (const value of ['0.29', '12500,29', '99999999.99']) assert.equal(expenseAmountError(value), null);
  for (const value of ['0', '-1', '1.001', '12.500', '1e5', '100000000', 'Infinity', 'NaN', '']) assert.ok(expenseAmountError(value));
});
test('Una coincidencia exige fecha exacta, responsable, importe, descripción, categoría, medio y notas', () => {
  assert.equal(matchesExpense(row, command), true);
  for (const [field, value] of Object.entries({ amount: 12500.30, responsible: 'Otra persona', description: 'Otro gasto', category: 'salary', paymentMethod: 'cash', notes: 'Otra factura', date: '2026-10-03T15:12:01.124Z' })) assert.equal(matchesExpense({ ...row, [field]: value }, command), false);
});
test('El intento pendiente se aísla por cuenta/establecimiento y no caduca automáticamente', () => {
  const pending = { version: 1, scope: 'actor-tenant-a', command: { ...command, date: '2020-01-01T12:00:00.000Z' } };
  assert.ok(readPendingExpense(JSON.stringify(pending), pending.scope));
  assert.equal(readPendingExpense(JSON.stringify(pending), 'actor-tenant-b'), null);
  assert.notEqual(pendingExpenseKey('a'), pendingExpenseKey('b'));
});
test('Respuestas incompletas y avisos corruptos no habilitan una recuperación falsa', () => {
  assert.equal(isExpenseRecord({ ...row, amount: Infinity }), false);
  assert.equal(isExpenseRecord({ ...row, id: '' }), false);
  assert.equal(isExpenseRecord({ ...row, status: 'unknown' }), false);
  assert.equal(readPendingExpense('{', 'a'), null);
  assert.equal(readPendingExpense(JSON.stringify({ version: 1, scope: 'a', command: { ...command, amount: 1.001 } }), 'a'), null);
  assert.equal(readPendingExpense('x'.repeat(30001), 'a'), null);
});

test('Consulta de egresos combina términos sin tildes, categoría y estado sin perder anulados', () => {
  const rows = [row, { ...row, id: 'voided-b', status: 'voided', responsible: 'María García', description: 'Compra champú' }, { ...row, id: 'rent-c', category: 'rent', responsible: null }];
  assert.equal(filterExpenses(rows, 'garcia champu', 'supplies', 'voided').map(x => x.id).join(','), 'voided-b');
  assert.equal(filterExpenses(rows, '', 'all', 'active').map(x => x.id).join(','), 'expense-a,rent-c');
  assert.equal(filterExpenses(rows, 'expense-a', 'all', 'all').length, 1);
  assert.equal(filterExpenses(rows, 'garcia', 'rent', 'all').length, 0);
  assert.equal(filterExpenses(rows, 'nunca registrado', 'all', 'all').length, 0);
});

test('Lectura histórica admite responsables heredados nulos y rechaza registros corruptos', () => {
  assert.equal(isExpenseHistoryRow({ ...row, responsible: null }), true);
  assert.equal(isExpenseHistoryRow({ ...row, status: 'voided', voidReason: 'Duplicado', voidedAt: command.date }), true);
  for (const mutation of [{ amount: NaN }, { status: 'unknown' }, { responsible: 123 }, { date: 'invalid' }, { voidedAt: 'invalid' }, { notes: {} }]) assert.equal(isExpenseHistoryRow({ ...row, ...mutation }), false);
});

test('El responsable prellenado no causa aviso; cada dato editado lo activa y restaurar lo elimina', () => {
  const initial = { description: '', responsible: 'Administrador', amount: '', notes: '', category: 'supplies', method: 'cash' };
  assert.equal(expenseFormDirty(initial, 'Administrador'), false);
  for (const [field, value] of Object.entries({ description: 'Compra', responsible: 'Ana', amount: '0', notes: 'Factura', category: 'rent', method: 'transfer' })) assert.equal(expenseFormDirty({ ...initial, [field]: value }, 'Administrador'), true);
  assert.equal(expenseFormDirty({ ...initial, responsible: '' }, 'Administrador'), true);
  assert.equal(expenseFormDirty(initial, 'Administrador'), false);
});
