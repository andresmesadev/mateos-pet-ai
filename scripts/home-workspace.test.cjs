const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const { effectiveAccess } = require('../backend/src/services/dashboard-access.service');
const context = { exports: {}, URLSearchParams };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('frontend/lib/home-workspace.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { homeHref, homeSources, dayCounts, clinicalPending, financialDay, pendingLabel, homeAppointments, orderHomeTasks, homeHasMissingSources } = context.exports;

for (const role of ['admin', 'receptionist', 'vet', 'groomer']) {
  test(`${role}: todos los módulos y permisos adicionales respetan las fuentes autorizadas`, () => {
    for (let bits = 0; bits < 8; bits++) for (let extra = 0; extra < 8; extra++) {
      const modules = ['veterinary', 'grooming', 'retail'].filter((_, i) => bits & (1 << i));
      const extras = ['cash', 'appointment_price', 'inventory_consume'].filter((_, i) => extra & (1 << i));
      const access = effectiveAccess({ type: role, staffId: 'staff-a', accessPermissions: extras }, modules);
      const sources = homeSources(access, '2026-10-07'), c = access.capabilities;
      for (const [key, allowed] of Object.entries({ appointments: c.agenda, clinical: c.clinical, grooming: c.grooming, conversations: c.chat, cash: c.cash, low: c.inventory_read, expired: c.inventory_read, expiring: c.inventory_read, finances: c.finance, followups: c.administration && c.services })) assert.equal(!!sources[key], !!allowed, `${role}/${modules}/${extras}/${key}`);
      if (role !== 'admin') assert.equal(sources.finances, null);
      if (bits === 4) assert.equal(sources.appointments, null, 'Pet shop no muestra agenda');
    }
  });
}
test('La navegación conserva establecimiento, caso, fecha y filtro, incluidos caracteres reservados', () => {
  const url = new URL(homeHref('/dashboard/consultas?date=2026-10-07&appointment=a%2Fb&care=pending-record', 'tenant & uno'), 'https://test.invalid');
  assert.equal(url.searchParams.get('tenant'), 'tenant & uno');
  assert.equal(url.searchParams.get('appointment'), 'a/b');
  assert.equal(url.searchParams.get('date'), '2026-10-07');
  assert.equal(url.searchParams.get('care'), 'pending-record');
  assert.equal(homeHref('/dashboard', null), '/dashboard');
  assert.equal(new URL(homeHref('/dashboard?tenant=old', 'new'), 'https://test.invalid').searchParams.get('tenant'), 'new');
});
test('Cancelaciones y ausencias no reaparecen como trabajo pendiente; horas cerca de medianoche usan Bogotá', () => {
  const row = { serviceCategory: 'veterinary', serviceType: 'vet', staffId: 'a', hasMedicalRecord: false, date: '2026-10-08T02:00:00Z' };
  const rows = ['pending', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show'].map(status => ({ ...row, status }));
  assert.equal(dayCounts(rows).scheduled, 2);
  assert.equal(dayCounts(rows).waiting, 1);
  assert.equal(dayCounts(rows).completed, 1);
  assert.equal(clinicalPending(rows, '2026-10-07', 'a').length, 2);
  assert.equal(clinicalPending(rows, '2026-10-08', 'a').length, 0);
  assert.equal(clinicalPending(rows, '2026-10-07', 'b').length, 0);
  assert.equal(clinicalPending([{ ...row, status: 'completed', hasMedicalRecord: undefined }], '2026-10-07').length, 0, 'Campo desconocido no equivale a historia pendiente');
  assert.equal(clinicalPending([{ ...row, status: 'completed', serviceCategory: 'grooming' }], '2026-10-07').length, 0);
});
test('Las áreas desactivadas no aparecen en la agenda de Inicio', () => {
  const access = effectiveAccess({ type: 'admin' }, ['grooming']);
  const rows = [{ serviceCategory: 'veterinary' }, { serviceCategory: 'grooming' }];
  assert.equal(homeAppointments(rows, access).length, 1);
  assert.equal(homeAppointments(rows, access)[0].serviceCategory, 'grooming');
});
test('Resultados conservan decimales y un listado parcial nunca afirma un total global', () => {
  const result = financialDay({ transactions: [{ total: 0.1 }, { total: 0.2 }], expenses: [{ amount: 0.05 }] });
  assert.equal(result.income, 0.3); assert.equal(result.difference, 0.25);
  assert.equal(pendingLabel(2, true), '2 en lista');
  assert.equal(pendingLabel(0, false), '0');
});

test('El orden del perfil conserva exclusivamente las tareas recibidas y no modifica el listado original', () => {
  const kinds = ['followups', 'cash', 'grooming', 'clinical', 'chat', 'expired', 'low', 'expiring'];
  const tasks = kinds.map((kind, i) => ({ kind, id: i }));
  for (const [role, first] of [['admin', 'expired'], ['receptionist', 'chat'], ['vet', 'clinical'], ['groomer', 'grooming']]) {
    const ordered = orderHomeTasks(tasks, role);
    assert.equal(ordered[0].kind, first);
    assert.equal(ordered.length, tasks.length);
    assert.equal(new Set(ordered.map(item => item.id)).size, tasks.length);
    assert.equal(tasks[0].kind, 'followups');
    assert.equal(orderHomeTasks([{ kind: 'cash' }], role)[0].kind, 'cash');
  }
  const sameKind = orderHomeTasks([{ kind: 'cash', id: 1 }, { kind: 'cash', id: 2 }], 'admin');
  assert.equal(sameKind[0].id, 1);
  assert.equal(sameKind[1].id, 2);
});

test('Actualización parcial distingue fallos autorizados, módulos desactivados y lecturas vacías válidas', () => {
  const paths = { profile: '/profile', appointments: '/appointments', finances: null };
  assert.equal(homeHasMissingSources(paths, { profile: { name: 'Centro' }, appointments: [], finances: null }), false);
  assert.equal(homeHasMissingSources(paths, { profile: null, appointments: [], finances: null }), true);
  assert.equal(homeHasMissingSources(paths, { profile: { name: 'Centro' }, appointments: null }), true);
  assert.equal(homeHasMissingSources(paths, { profile: { name: 'Centro' } }), true);
});
