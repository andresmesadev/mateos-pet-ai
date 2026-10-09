const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const path = require('node:path');
const context = { exports: {}, require: ref => {
  const loaded = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../frontend/lib', ref + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, loaded);
  return loaded.exports;
} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../frontend/lib/pos-cash.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { summarizeCash, filterCash, isCashData } = context.exports;
const row = (id, total, paymentMethod = 'cash') => ({ id, total, paymentMethod, clientName: 'Andrés Pérez', petName: 'Luna', items: [{ description: 'Baño básico' }] });
const rows = [row('a', 0.1), row('b', 0.2), row('review', 55000), row('transfer', 12000, 'transfer')];
const review = new Set(['review', 'missing']);

test('Cash validates complete totals across pages and rejects mismatched review identity or amounts', () => {
  const transaction = {id:'review',total:10,paymentMethod:'cash',origin:'system_appointment_completed',status:'active',paidAt:new Date().toISOString(),items:[],recordedBy:null};
  const methods = Object.fromEntries(['cash','transfer','card','other'].map(method=>[method,{count:0,cents:0}]));
  const page = {date:'2026-10-08',scope:'pending',data:[transaction],transactions:[transaction],toReview:['review'],total:201,page:201,pageSize:1,totalPages:201,summary:{activeCount:201,voidedCount:0,activeTotal:2010},summaryCash:{methods,reviewCount:201,reviewCents:201000},pendingCount:201,totalRegistered:2010,hasMore:false};
  assert.equal(isCashData(page),true);
  assert.equal(isCashData({...page,totalRegistered:10}),false);
  assert.equal(isCashData({...page,toReview:[]}),false);
  assert.equal(isCashData({...page,summaryCash:{...page.summaryCash,reviewCount:1}}),false);
});
test('Los métodos confirmados excluyen el efectivo por defecto de una cita sin revisar', () => {
  const summary = summarizeCash(rows, review);
  assert.equal(summary.methods.cash.cents, 30);
  assert.equal(summary.methods.cash.count, 2);
  assert.equal(summary.reviewCents, 5500000);
  assert.equal(summary.reviewCount, 1);
  assert.equal(summary.methods.transfer.cents, 1200000);
});
test('La búsqueda combina dueño, mascota y servicio sin depender de tildes ni orden', () => {
  assert.equal(filterCash(rows, review, 'basico ANDRES luna', 'all', 'all').length, 4);
  assert.equal(filterCash(rows, review, 'otro', 'all', 'all').length, 0);
});
test('Filtros por revisión y método no muestran el método sin confirmar como efectivo', () => {
  assert.equal(filterCash(rows, review, '', 'all', 'cash').length, 2);
  assert.equal(filterCash(rows, review, '', 'review', 'all')[0].id, 'review');
  assert.equal(filterCash(rows, review, '', 'registered', 'all').length, 3);
  assert.equal(filterCash(rows, review, '', 'review', 'cash').length, 0);
  assert.equal(filterCash([], review, '', 'all', 'all').length, 0);
});
