const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('../frontend/node_modules/typescript');
const path = require('node:path');
function load(file) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const result = { exports: {} };
  new Function('require', 'module', 'exports', output)(child => load(path.resolve(path.dirname(file), child + '.ts')), result, result.exports);
  return result.exports;
}
const { DAY_GROUPS, matchesDayGroup, agendaFirst, ageLabel, homeDataIsStale, HOME_STALE_MS, homeDayFilters, homePriorityFilters, followupTiming } = load(path.join(__dirname, '../frontend/lib/home-adaptability.ts'));
test('Day cards share status groups and exclude absences from operational states', () => {
  const statuses = ['pending', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show'];
  const expected = { scheduled: ['pending', 'confirmed'], waiting: ['arrived'], inProgress: ['in_progress'], completed: ['completed'] };
  for (const { key } of DAY_GROUPS) assert.deepEqual(statuses.filter(status => matchesDayGroup({ status }, key)), expected[key]);
  assert(statuses.every(status => matchesDayGroup({ status }, 'all')));
});
test('Operational staff have agenda first; administrators retain priorities first', () => {
  assert.equal(agendaFirst('admin'), false);
  for (const role of ['receptionist', 'vet', 'groomer']) assert.equal(agendaFirst(role), true);
});
test('Relative time handles initial, stale and invalid dates without negative ages', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');
  assert.equal(ageLabel(new Date(now - 59000).toISOString(), now), 'hace menos de un minuto');
  assert.equal(ageLabel(new Date(now - 60000).toISOString(), now), 'hace 1 minuto');
  assert.equal(ageLabel(new Date(now - 300000).toISOString(), now), 'hace 5 minutos');
  assert.equal(ageLabel('invalid', now), '');
  assert.equal(ageLabel(new Date(now + 1000).toISOString(), now), 'hace menos de un minuto');
});
test('Staleness includes the Colombia day boundary before two minutes', () => {
  const now = Date.parse('2026-10-09T05:00:10Z');
  assert.equal(homeDataIsStale(new Date(now - 20000).toISOString(), now), true);
  const daytime = Date.parse('2026-10-08T12:00:00Z');
  assert.equal(homeDataIsStale(new Date(daytime - HOME_STALE_MS + 1).toISOString(), daytime), false);
  assert.equal(homeDataIsStale(new Date(daytime - HOME_STALE_MS).toISOString(), daytime), true);
  assert.equal(homeDataIsStale(undefined, daytime), true);
});

test('Saved Home preferences validate live agenda access, unknown values and shorter priority lists', () => {
  assert.equal(homeDayFilters({ dayFilter: 'waiting' }, true).dayFilter, 'waiting');
  assert.equal(homeDayFilters({ dayFilter: 'waiting' }, false).dayFilter, 'all');
  assert.equal(homeDayFilters({ dayFilter: 'unavailable' }, true).dayFilter, 'all');
  assert.equal(homePriorityFilters({ priorityPage: '9' }, 2).priorityPage, '2');
  for (const value of ['-1', '1.5', 'NaN', '100000', {}, 2]) assert.equal(homePriorityFilters({ priorityPage: value }, 3).priorityPage, '1');
  assert.equal(homePriorityFilters({ priorityPage: '3' }, 0).priorityPage, '1');
});
test('Follow-up age uses Colombia calendar days, offsets and leap dates', () => {
  assert.equal(followupTiming('2026-10-08T04:59:59Z', '2026-10-08').label, 'Pendiente hace 1 día');
  assert.equal(followupTiming('2026-10-08T05:00:00Z', '2026-10-08').label, 'Para hoy');
  assert.equal(followupTiming('2026-10-05T00:00:00-05:00', '2026-10-08').label, 'Pendiente hace 3 días');
  assert.equal(followupTiming('2026-10-08', '2026-10-08').date, '2026-10-08');
  assert.equal(followupTiming('2024-02-29T05:00:00Z', '2024-03-01').days, 1);
  assert.equal(followupTiming('2026-10-09T05:00:00Z', '2026-10-08').label, 'Próximo seguimiento');
});
test('Invalid follow-up dates stay unavailable rather than becoming today or overdue', () => {
  for (const value of [undefined, null, '', 'invalid', '2026-02-30T05:00:00Z', '2026-10-08T10:00:00']) {
    const timing = followupTiming(value, '2026-10-08');
    assert.equal(timing.date, null);assert.equal(timing.days, null);assert.equal(timing.label, 'Fecha no disponible');
  }
  assert.equal(followupTiming('2026-10-08', 'bad').date, null);
});
