const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
const source = fs.readFileSync(path.join(__dirname, '../frontend/lib/agenda-display.ts'), 'utf8');
const moduleResult = { exports: {} };
new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(moduleResult, moduleResult.exports);
const { visibleAgendaAppointments, agendaPage } = moduleResult.exports;
const rows = count => Array.from({ length: count }, (_, i) => ({ id: `appointment-${i}`, status: 'confirmed' }));

test('Nine and ten appointments are all accessible without another page', () => {
  for (const count of [9, 10]) {
    const page = agendaPage(rows(count), 1);
    assert.equal(page.pages, 1);assert.equal(page.appointments.length, count);assert.equal(page.end, count);
  }
});
test('Eleven and twenty-one appointments can be traversed without missing or repeating rows', () => {
  for (const count of [11, 21]) {
    const appointments = rows(count);const ids = [];
    for (let i = 1; i <= Math.ceil(count / 10); i++) ids.push(...agendaPage(appointments, i).appointments.map(a => a.id));
    assert.deepEqual(ids, appointments.map(a => a.id));
  }
});
test('Cancellation removes rows before counting and paging, preserving no-shows and completed appointments', () => {
  const appointments = [...rows(9), { id: 'cancelled', status: 'cancelled' }, { id: 'completed', status: 'completed' }, { id: 'absence', status: 'no_show' }];
  const visible = visibleAgendaAppointments(appointments);
  assert.equal(agendaPage(visible, 1).total, 11);assert.equal(agendaPage(visible, 2).appointments[0].id, 'absence');
  assert.equal(appointments.length, 12);assert.equal(appointments[9].status, 'cancelled');
});
test('A refreshed list shrinking from two pages cannot leave an empty last page', () => {
  assert.equal(agendaPage(rows(11), 2).page, 2);
  const next = agendaPage(rows(10), 2);
  assert.equal(next.page, 1);assert.equal(next.appointments.length, 10);
  for (const value of [-1, NaN, Infinity]) assert.equal(agendaPage(rows(11), value).page, 1);
  assert.deepEqual(agendaPage([], 2), { page: 1, pages: 1, total: 0, start: 0, end: 0, appointments: [] });
});
