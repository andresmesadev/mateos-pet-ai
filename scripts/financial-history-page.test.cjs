const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const context = { exports: {}, Number, Math, Array };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../frontend/lib/financial-history-page.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { isHistoryPage } = context.exports;
const isRow = row => typeof row?.id === 'string';
const valid = { data: [{ id: 'last-row' }], total: 201, page: 21, pageSize: 10, totalPages: 21, summary: { activeCount: 200, voidedCount: 1, activeTotal: 1000.29 } };
test('el detalle paginado verifica conteos y suma completa sin confundirla con la página', () => {
  assert.equal(isHistoryPage(valid, isRow), true);
  for (const value of [{ ...valid, total: 200 }, { ...valid, totalPages: 20 }, { ...valid, data: [] }, { ...valid, data: [{}] }, { ...valid, page: 0 }, { ...valid, page: 22 }, { ...valid, summary: { ...valid.summary, activeTotal: NaN } }, { ...valid, summary: { ...valid.summary, voidedCount: 2 } }, { ...valid, summary: undefined }]) assert.equal(isHistoryPage(value, isRow), false);
});
test('un vacío confirmado exige metadatos coherentes; una respuesta incompleta no muestra cero', () => {
  assert.equal(isHistoryPage({ data: [], total: 0, page: 1, pageSize: 10, totalPages: 1, summary: { activeCount: 0, voidedCount: 0, activeTotal: 0 } }, isRow), true);
  assert.equal(isHistoryPage([], isRow), false); assert.equal(isHistoryPage({}, isRow), false);
});
