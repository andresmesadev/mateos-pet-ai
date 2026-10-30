const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('frontend/lib/service-status.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { parseServiceStatus, SERVICE_STATES } = context.exports;
const valid = { tenantId: 'own', checkedAt: '2026-10-30T18:00:00Z', dashboard: { state: 'responding' }, whatsapp: { state: 'paused' }, ai: { state: 'unverified' } };
test('rejects foreign, malformed and unexpected status responses instead of showing success', () => {
  assert.equal(parseServiceStatus(valid, 'own'), valid);
  for (const value of [null, {}, { ...valid, tenantId: 'other' }, { ...valid, checkedAt: 'invalid' }, { ...valid, whatsapp: { state: '__proto__' } }, { ...valid, ai: { state: 'all_good' } }, { ...valid, ai: { state: 'degraded', observedAt: 'invalid' } }]) {
    assert.throws(() => parseServiceStatus(value, 'own'));
  }
});
test('wording distinguishes configuration and limited observation from guaranteed availability', () => {
  assert.match(SERVICE_STATES.whatsapp.configured[1], /no confirma la entrega/);
  assert.match(SERVICE_STATES.ai.observed_ok[1], /no garantiza/);
  assert.match(SERVICE_STATES.ai.unverified[1], /No se ha comprobado/);
  assert.match(SERVICE_STATES.ai.degraded[1], /atención manual/);
});
