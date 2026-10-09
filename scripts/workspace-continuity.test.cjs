const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../frontend/node_modules/typescript');
function load(name) {
  const source = fs.readFileSync(path.join(__dirname, '../frontend/lib', name + '.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} }; new Function('module', 'exports', output)(module, module.exports); return module.exports;
}
const filters = load('list-continuity'), storage = load('workspace-session');
function memory() { const items = new Map(); return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key), key: i => [...items.keys()][i], get length() { return items.size; } }; }
test('Dates reject invalid days and accept leap dates', () => {
  for (const value of ['2026-02-30', '2026-13-01', '2026-01-00', 'invalid', '2026-01-01T12:00']) assert.equal(filters.validListDate(value, '2026-10-08'), '2026-10-08');
  assert.equal(filters.validListDate('2028-02-29', 'fallback'), '2028-02-29');
});
test('Inventory filters follow live modules and permissions', () => {
  const role = { activeModules: ['veterinary', 'grooming', 'retail'], capabilities: { clinical: true } };
  assert.deepEqual(filters.inventoryListFilters({ use: 'retail', inactive: '1', status: 'unknown', q: 'x'.repeat(200) }, role), { q: 'x'.repeat(100), use: '', status: '', inactive: '0' });
  assert.equal(filters.inventoryListFilters({ use: 'veterinary' }, role).use, 'veterinary');
  assert.equal(filters.inventoryListFilters({ inactive: '1' }, { ...role, capabilities: { inventory_manage: true } }).inactive, '1');
});
test('Clinical filters validate professionals, role and aliases', () => {
  assert.equal(filters.clinicalListFilters({ staff: 'other', care: 'pending-record' }, '2026-10-08', 'vet', ['other']).staff, 'vet');
  assert.equal(filters.clinicalListFilters({ staff: 'removed' }, '2026-10-08', null, ['vet']).staff, 'all');
  assert.equal(filters.clinicalListFilters({ care: 'pending-record' }, '2026-10-08', null, []).care, 'Historias pendientes');
  assert.equal(filters.clinicalListFilters({ date: '2026-09-01' }, '2026-10-08', null, []).scope, 'week');
});
test('Grooming history rejects incompatible stages and removed professionals', () => {
  assert.equal(filters.groomingListFilters({ stage: 'En espera', view: 'history', staff: 'removed' }, '2026-10-08', ['groomer']).stage, 'all');
  assert.equal(filters.groomingListFilters({ stage: 'ready', view: 'all' }, '2026-10-08', []).stage, 'Listas para entrega');
  assert.equal(filters.groomingListFilters({ staff: 'removed' }, '2026-10-08', []).staff, 'all');
});
test('Owner changes and sign-out erase workspace state but preserve unrelated storage', () => {
  const tab = memory(); tab.setItem('pos-sale', 'keep'); storage.ensureWorkspaceOwner(tab, 'first');
  const key = storage.workspaceKey('first', 'tenant-a', 'filters'); storage.writeWorkspaceValue(tab, key, { q: 'private' });
  assert.notEqual(key, storage.workspaceKey('first', 'tenant-b', 'filters')); assert.notEqual(key, storage.workspaceKey('second', 'tenant-a', 'filters'));
  storage.ensureWorkspaceOwner(tab, 'second'); assert.equal(tab.getItem(key), null); assert.equal(tab.getItem('pos-sale'), 'keep');
  storage.ensureWorkspaceOwner(tab, null); assert.equal(tab.length, 1);
});
test('Expired, future and malformed stored values are removed', () => {
  const tab = memory(), key = 'test'; storage.writeWorkspaceValue(tab, key, { q: 'valid' }, 1000);
  assert.deepEqual(storage.readWorkspaceValue(tab, key, 100, 1099), { q: 'valid' });
  assert.equal(storage.readWorkspaceValue(tab, key, 100, 1100), null); assert.equal(tab.getItem(key), null);
  storage.writeWorkspaceValue(tab, key, {}, 2000); assert.equal(storage.readWorkspaceValue(tab, key, 100, 1000), null);
  tab.setItem(key, '{bad'); assert.equal(storage.readWorkspaceValue(tab, key, 100), null);
});
test('Unavailable browser storage does not break ordinary operations', () => {
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }, removeItem() { throw Error('denied'); } };
  assert.equal(storage.readWorkspaceValue(denied, 'key', 100), null); assert.equal(storage.writeWorkspaceValue(denied, 'key', {}), false);
  assert.equal(storage.writeWorkspaceValue(null, 'key', {}), false); assert.doesNotThrow(() => storage.ensureWorkspaceOwner(denied, 'owner'));
});
test('Draft recovery expires each entry, validates identities and caps size and count', () => {
  const now = storage.DRAFT_TTL + 10000;
  const raw = { 'tenant:owner': { text: 'valid', savedAt: now }, 'tenant:expired': { text: 'old', savedAt: now - storage.DRAFT_TTL }, 'tenant:future': { text: 'future', savedAt: now + 1 }, 'invalid': { text: 'bad', savedAt: now }, 'tenant:large': { text: 'x'.repeat(4097), savedAt: now }, 'tenant:blank': { text: '  ', savedAt: now } };
  assert.deepEqual(storage.validDrafts(raw, now), { 'tenant:owner': raw['tenant:owner'] });
  const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['tenant:user-' + i, { text: 'draft', savedAt: now - i }]));
  assert.equal(Object.keys(storage.validDrafts(many, now)).length, 30); assert(!storage.validDrafts(many, now)['tenant:user-39']);
});
