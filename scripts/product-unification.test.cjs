const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/node_modules/typescript');
const { effectiveAccess } = require('../backend/src/services/dashboard-access.service');
function readModule(file) {
  const source = fs.readFileSync(require('node:path').join(__dirname, '../frontend/lib/', file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} }; new Function('module', 'exports', output)(module, module.exports); return module.exports;
}
const { canonicalDashboardHref } = readModule('dashboard-navigation.ts');
const { operationGuides } = readModule('operation-guides.ts');
test('Legacy destinations retain selected tenant, case, filters and repeated parameters', () => {
  const url = new URL(canonicalDashboardHref('/dashboard/contacto', { tenant: 'centro & dos', client: 'cliente-1', pet: 'mascota-1', new: 'mascota', search: 'Baño + corte', tag: ['a', 'b'], ignored: undefined }, { view: 'mascotas' }), 'http://test');
  assert.equal(url.pathname, '/dashboard/contacto');
  for (const [key, value] of Object.entries({ tenant: 'centro & dos', client: 'cliente-1', pet: 'mascota-1', new: 'mascota', search: 'Baño + corte', view: 'mascotas' })) assert.equal(url.searchParams.get(key), value);
  assert.deepEqual(url.searchParams.getAll('tag'), ['a', 'b']); assert.equal(url.searchParams.has('ignored'), false);
  const report = new URL(canonicalDashboardHref('/dashboard/pos', { tenant: 't', period: 'year', tab: 'obsolete', date: '2026-10-01' }, { tab: 'reportes' }), 'http://test');
  assert.equal(report.searchParams.get('tab'), 'reportes'); assert.equal(report.searchParams.get('period'), 'year'); assert.equal(report.searchParams.get('date'), '2026-10-01');
});
test('Operation help follows actual capabilities for 4 roles, 7 module combinations and optional permissions', () => {
  let checked = 0;
  for (const role of ['admin', 'receptionist', 'vet', 'groomer']) for (let mask = 1; mask <= 7; mask++) for (const extras of [[], ['cash'], ['inventory_read'], ['inventory_consume']]) {
    const modules = ['veterinary', 'grooming', 'retail'].filter((_, index) => mask & (1 << index));
    const access = effectiveAccess({ type: role, staffId: role, accessPermissions: extras }, modules), c = access.capabilities;
    const guides = operationGuides(access);
    assert.deepEqual(guides.map(guide => guide.id), [...(c.agenda ? ['agenda'] : []), ...(c.clinical ? ['consultas'] : []), ...(c.grooming ? ['peluqueria'] : []), ...(c.cash ? ['pos'] : [])]);
    for (const guide of guides) assert(guide.steps.length >= 3 && guide.steps.length <= 5);
    checked++;
  }
  assert.equal(checked, 112);
});
test('Cleanup keeps the current home and shared types; replaced screens remain aliases', () => {
  for (const alias of ['clients', 'pets', 'services', 'staff', 'reports']) assert.match(fs.readFileSync(`frontend/app/dashboard/${alias}/page.tsx`, 'utf8'), /redirect\(canonicalDashboardHref/);
  assert.match(fs.readFileSync('frontend/app/dashboard/page.tsx', 'utf8'), /HomeWorkspace/);
  assert.match(fs.readFileSync('frontend/components/dashboard/home/fetchers.ts', 'utf8'), /export type UpcomingReminder/);
  for (const file of ['home/operational-home.tsx', 'home/sections.tsx', 'daily-metrics-cards.tsx', 'services-manager.tsx']) assert.equal(fs.existsSync('frontend/components/dashboard/' + file), false);
});
