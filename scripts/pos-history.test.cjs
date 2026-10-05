const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../frontend/lib/pos-history.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { historyQuickRange, initialHistoryRange, transactionNeedsReview, filterTransactions, summarizeHistory, inventoryReturnProgress, isHistoryTransaction } = context.exports;
const json = value => JSON.parse(JSON.stringify(value));
const item = { id: 'line', description: 'Champú', quantity: 1, unitPrice: 12.34, total: 12.34 };
const sale = { id: 'sale', total: 12.34, paidAt: '2026-10-03T15:00:00Z', status: 'active', origin: 'manual_pos_sale', paymentMethod: 'cash', clientName: 'Andrés Pérez', petName: 'Luna', recordedBy: { id: 'staff', name: 'María Gómez' }, items: [item] };

test('Periodos rápidos son inclusivos y cruzan meses, años y febrero bisiesto', () => {
  assert.deepEqual(json(historyQuickRange('2026-01-01', 'yesterday')), { from: '2025-12-31', to: '2025-12-31' });
  assert.deepEqual(json(historyQuickRange('2024-03-01', 'week')), { from: '2024-02-24', to: '2024-03-01' });
  assert.deepEqual(json(historyQuickRange('2026-10-03', 'month')), { from: '2026-10-01', to: '2026-10-03' });
  assert.deepEqual(json(historyQuickRange('2026-10-03', 'today')), { from: '2026-10-03', to: '2026-10-03' });
});
test('Rango inicial termina hoy o al fin real de un mes anterior; evita meses futuros o inválidos', () => {
  assert.deepEqual(json(initialHistoryRange('2024-02', '2026-10-03')), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(json(initialHistoryRange('2026-09', '2026-10-03')), { from: '2026-09-01', to: '2026-09-30' });
  for (const period of ['2026-10', '2027-01', 'bad', '2026-13', '0000-02']) assert.deepEqual(json(initialHistoryRange(period, '2026-10-03')), { from: '2026-10-01', to: '2026-10-03' });
});
test('Búsqueda combina dueño, mascota, artículo y operador sin depender del orden ni tildes', () => {
  assert.equal(filterTransactions([sale], 'maria luna andres champu', 'cash', 'active', 'manual_pos_sale').length, 1);
  assert.equal(filterTransactions([sale], 'maria desconocido', 'all', 'all').length, 0);
  assert.equal(filterTransactions([sale], '', 'all', 'all', 'system_appointment_completed').length, 0);
});
test('El método predeterminado de una cita sin operador se muestra por revisar y no como efectivo confirmado', () => {
  const system = { ...sale, origin: 'system_appointment_completed', recordedBy: null };
  assert.equal(transactionNeedsReview(system), true);
  assert.equal(filterTransactions([system], '', 'cash', 'all').length, 0);
  assert.equal(filterTransactions([system], '', 'review', 'all').length, 1);
  assert.equal(transactionNeedsReview({ ...system, recordedBy: sale.recordedBy }), false);
  assert.equal(filterTransactions([sale], '', 'review', 'all').length, 0);
});
test('Resumen respeta centavos y excluye anulaciones del importe activo', () => {
  const rows = [{ ...sale, total: 0.1 }, { ...sale, total: 0.2 }, { ...sale, status: 'voided', total: 100 }];
  assert.deepEqual(json(summarizeHistory(rows)), { active: 2, voided: 1, activeTotal: 0.3 });
  assert.deepEqual(json(summarizeHistory([])), { active: 0, voided: 0, activeTotal: 0 });
});
test('Mercancía pendiente aparece solo tras anular, distingue recepciones y excluye servicios', () => {
  const pending = { ...item, productId: 'product' };
  const received = { ...pending, id: 'received', inventoryReturn: { id: 'return', disposition: 'restock', quantity: 1 } };
  const row = { ...sale, items: [pending, received, item] };
  assert.equal(inventoryReturnProgress(row).pending.length, 0);
  const progress = inventoryReturnProgress({ ...row, status: 'voided' });
  assert.equal(progress.pending.length, 1); assert.equal(progress.pending[0].id, 'line');
  assert.equal(progress.received.length, 1); assert.equal(progress.received[0].id, 'received');
});
test('Respuestas incompletas o importes inválidos no se aceptan como historial confirmado', () => {
  assert.equal(isHistoryTransaction(sale), true);
  assert.equal(isHistoryTransaction({ ...sale, status: 'voided', voidReason: 'Error', voidedAt: sale.paidAt }), true);
  for (const row of [null, {}, { ...sale, total: '12.34' }, { ...sale, total: -1 }, { ...sale, paidAt: 'bad' }, { ...sale, voidReason: {} }, { ...sale, items: null }, { ...sale, items: [{ ...item, quantity: 1.5 }] }, { ...sale, items: [{ ...item, unitPrice: -5 }] }, { ...sale, items: [{ ...item, inventoryReturn: { id: 'r', quantity: 1, disposition: 'unknown' } }] }]) assert.equal(isHistoryTransaction(row), false);
});
