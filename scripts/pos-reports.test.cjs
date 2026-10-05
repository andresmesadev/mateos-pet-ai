const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const context = { exports: {}, Intl, Date, URLSearchParams };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../frontend/lib/pos-reports.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { parseReportSummary, parseRevenueMonths, parseBreakdown, parseActivity, parseServices, reportRange, reportMoney, reportBarHeight } = context.exports;
const meta = { period: 'month', offset: 0, comparison: 'full', comparisonClamped: false, rangeStart: '2026-10-01T05:00:00Z', rangeEnd: '2026-11-01T05:00:00Z', previousRangeStart: '2026-09-01T05:00:00Z', previousRangeEnd: '2026-10-01T05:00:00Z', asOf: '2026-10-03T15:00:00Z', partial: true, year: 2026 };
const metric = { value: 10.1, prev: 0, delta: 10.1, pct: null };
const summary = { ...meta, establishment: { id: 'tenant-a', name: 'Mateos prueba' }, revenue: metric, expenses: metric, difference: { ...metric, value: -2.5, delta: -2.5 }, appointments: metric, newClients: metric, petsAttended: metric, transactionCount: 2 };
const breakdown = { ...meta, total: 0.3, count: 2, unallocatedTotal: 0.1, byMethod: ['cash', 'transfer', 'card', 'other', 'review', 'unclassified'].map((method, index) => ({ method, count: index < 2 ? 1 : 0, total: index === 0 ? 0.1 : index === 1 ? 0.2 : 0 })), byKind: ['product', 'service', 'unclassified'].map((kind, index) => ({ kind, quantity: index === 0 ? 1 : 0, lines: index === 0 ? 1 : 0, total: index === 0 ? 0.2 : 0 })) };

test('rangos visibles terminan en el último día real de Bogotá y cruzan el año', () => {
  const range = reportRange(meta.rangeStart, meta.rangeEnd);
  assert.match(range, /1(?: de)? oct/); assert.match(range, /31(?: de)? oct/); assert.doesNotMatch(range, /nov/);
  assert.match(reportRange('2025-12-29T05:00:00Z', '2026-01-05T05:00:00Z'), /4(?: de)? ene.*2026/);
});
test('COP conserva centavos y diferencias negativas', () => {
  assert.match(reportMoney(7500.19), /7\.500,19/);
  assert.match(reportMoney(-12.34), /-.*12,34/);
  assert.match(reportMoney(55000), /55\.000/); assert.doesNotMatch(reportMoney(55000), /,00/);
});
test('resumen incompleto, no finito o con fechas invertidas nunca representa cero confirmado', () => {
  assert.equal(parseReportSummary(summary).difference.value, -2.5);
  for (const row of [{}, { ...summary, revenue: { ...metric, value: NaN } }, { ...summary, expenses: { ...metric, value: -1 } }, { ...summary, rangeEnd: meta.rangeStart }, { ...summary, partial: undefined }, { ...summary, transactionCount: 1.5 }]) assert.throws(() => parseReportSummary(row));
});
test('doce meses consecutivos del mismo año son obligatorios para el contexto anual', () => {
  const months = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, year: 2026, revenue: 12.34 }));
  assert.equal(parseRevenueMonths(months).length, 12);
  for (const rows of [[], months.slice(1), [...months.slice(0, 11), { month: 11, year: 2026, revenue: 2 }], months.map(row => ({ ...row, year: row.month === 12 ? 2025 : 2026 }))]) assert.throws(() => parseRevenueMonths(rows));
});
test('desglose reconcilia centavos, cantidades y diferencias sin atribuirlas a servicios', () => {
  assert.equal(parseBreakdown(breakdown).unallocatedTotal, 0.1);
  assert.equal(parseBreakdown({ ...breakdown, byKind: breakdown.byKind.map(row => ({ ...row, total: row.kind === 'product' ? 0.4 : 0 })), unallocatedTotal: -0.1 }).unallocatedTotal, -0.1);
  for (const row of [{ ...breakdown, total: 0.4 }, { ...breakdown, count: 3 }, { ...breakdown, unallocatedTotal: 0 }, { ...breakdown, byMethod: breakdown.byMethod.map(entry => ({ ...entry, method: 'cash' })) }, { ...breakdown, byKind: [] }]) assert.throws(() => parseBreakdown(row));
});
test('ranking y actividad rechazan datos incompletos, sin inventar retención', () => {
  assert.equal(parseServices([{ name: '__proto__', count: 2 }])[0].count, 2);
  assert.equal(parseServices([]).length, 0); assert.throws(() => parseServices([{ name: 'Baño', count: -1 }]));
  const rows = Array.from({ length: 6 }, (_, index) => ({ label: String(index), newClients: 1, returningVisits: 2 }));
  assert.equal(parseActivity(rows)[0].returningVisits, 2);
  assert.throws(() => parseActivity(rows.slice(1))); assert.throws(() => parseActivity(rows.map(row => ({ ...row, newClients: '1' }))));
});
test('barras tienen altura real, ceros invisibles y cantidades pequeñas legibles', () => {
  assert.equal(reportBarHeight(100, 100), 150); assert.equal(reportBarHeight(50, 100), 75);
  assert.equal(reportBarHeight(0, 0), 0); assert.equal(reportBarHeight(0.01, 10000), 2);
});

test('enlaces conservan fechas inclusivas, selección y tenant; parámetros ambiguos se descartan', () => {
  const { reportDetailUrl, readReportDetail, reportReturnUrl, readReportSelection } = context.exports;
  for (const kind of ['income', 'expense', 'review']) {
    const url = new URL(reportDetailUrl(meta, kind, 'tenant & literal'), 'http://localhost');
    const params = Object.fromEntries(url.searchParams);
    assert.equal(params.tab, kind === 'expense' ? 'egreso' : 'historial');
    assert.equal(params.from, '2026-10-01'); assert.equal(params.to, '2026-10-31');
    assert.equal(params.tenant, 'tenant & literal');
    const detail = readReportDetail(params);
    assert.equal(detail.kind, kind);
    const back = new URL(reportReturnUrl(detail.selection, params.tenant), 'http://localhost');
    assert.equal(back.searchParams.get('period'), 'month'); assert.equal(back.searchParams.get('comparison'), 'full');
  }
  const base = { source: 'reports', detail: 'income', from: '2026-10-01', to: '2026-10-31' };
  for (const params of [{ ...base, detail: ['income'] }, { ...base, from: '2026-02-30' }, { ...base, to: '2026-09-30' }, { ...base, to: '2030-10-31' }, { ...base, from: ['2026-10-01'] }]) assert.equal(readReportDetail(params), undefined);
  assert.equal(readReportSelection({ period: ['week'], offset: '-1201', comparison: ['equivalent'] }).period, 'month');
  assert.equal(readReportSelection({ period: 'year', offset: '-2', comparison: 'equivalent' }).offset, -2);
});
test('exportación exige fechas, selección y centavos coincidentes; errores no exportan ceros', () => {
  const { reportsAgree } = context.exports;
  const same = { ...summary, revenue: { ...metric, value: breakdown.total } };
  assert.equal(reportsAgree(same, breakdown), true);
  for (const other of [undefined, { ...breakdown, count: 3 }, { ...breakdown, total: 0.4 }, { ...breakdown, comparison: 'equivalent' }, { ...breakdown, previousRangeEnd: meta.previousRangeStart }]) assert.equal(reportsAgree(same, other), false);
  assert.equal(reportsAgree(undefined, breakdown), false);
});
test('Excel se abre con tres hojas, importes numéricos exactos y nombres literales sin fórmulas', async () => {
  const Excel = require('../frontend/node_modules/exceljs');
  const exportsContext = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(require.resolve('../frontend/lib/pos-report-export.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  // ExcelJS checks row arrays in its own realm; execute this adapter in Node's realm.
  new Function('exports', 'require', compiled)(exportsContext.exports, name => name === 'exceljs' ? Excel : context.exports);
  const same = { ...summary, establishment: { id: 'tenant-a', name: '=HYPERLINK("https://invalid")' }, revenue: { ...metric, value: breakdown.total } };
  const buffer = await exportsContext.exports.createReportWorkbook(same, breakdown);
  const book = new Excel.Workbook(); await book.xlsx.load(buffer);
  assert.equal(book.worksheets.length, 3);
  assert.equal(book.getWorksheet('Resumen').getCell('B1').value, same.establishment.name);
  assert.equal(book.getWorksheet('Resumen').getCell('B11').value, 0.3);
  assert.equal(book.getWorksheet('Resumen').getCell('B13').value, -2.5);
  assert.equal(book.getWorksheet('Medios de pago').getCell('C2').value, 0.1);
  assert.equal(book.getWorksheet('Medios de pago').getCell('C8').value, 0.3);
  assert.equal(book.getWorksheet('Productos y servicios').getCell('D5').value, 0.1);
  assert.equal(book.getWorksheet('Resumen').getCell('B11').type, Excel.ValueType.Number);
  assert.match(exportsContext.exports.reportFilename(same), /2026-10-01-2026-10-31\.xlsx$/);
  await assert.rejects(exportsContext.exports.createReportWorkbook(summary, breakdown));
});
