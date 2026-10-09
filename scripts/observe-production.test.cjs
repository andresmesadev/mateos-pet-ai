const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sample, summarize, safeOutput } = require('./observe-production.cjs');
const start = Date.parse('2026-10-09T12:00:00Z');
function point(i, changes = {}) {
  return { at: new Date(start + i * 300000).toISOString(), ok: true, version: '2.45.0',
    workerStartedAt: '2026-10-09T04:45:00Z', lastFailureAt: null, ...changes };
}
function payload(worker = {}) {
  return { version: '2.45.0', status: 'ok', services: { database: 'ok', openai: 'ok', inboundWorker: 'ok' },
    workers: { inbound: { status: 'ok', healthy: true, consecutiveFailures: 0,
      startedAt: '2026-10-09T04:45:00Z', lastSuccessAt: '2026-10-09T11:59:58Z', lastFailureAt: null, ...worker } } };
}

test('A complete healthy window passes; short duration and sampling gaps remain incomplete', () => {
  const points = Array.from({ length: 577 }, (_, i) => point(i));
  assert.equal(summarize(points).verdict, 'health_window_passed');
  assert.equal(summarize(points.slice(0, -1)).verdict, 'incomplete');
  assert.equal(summarize(points.filter((_, i) => i !== 20)).verdict, 'incomplete');
  assert.equal(summarize([]).verdict, 'incomplete');
});

test('A restart, version change or observed worker failure prevents a clean window', () => {
  for (const change of [{ ok: false }, { version: '2.46.0' }, { workerStartedAt: point(1).at }, { lastFailureAt: point(1).at }]) {
    assert.equal(summarize([point(0), point(1, change), point(2)]).verdict, 'incident');
  }
  assert.throws(() => summarize([point(1), point(0)]));
  assert.throws(() => summarize([point(0), point(0)]));
});

test('Live samples require healthy services and worker, not just HTTP 200', async () => {
  const fetcher = body => async () => ({ status: 200, json: async () => body });
  assert.equal((await sample(fetcher(payload()), () => start)).ok, true);
  for (const body of [payload({ status: 'starting' }), payload({ healthy: false }), payload({ consecutiveFailures: 1 }), payload({ lastSuccessAt: null }), { ...payload(), services: { database: 'error', openai: 'ok' } }]) {
    assert.equal((await sample(fetcher(body), () => start)).ok, false);
  }
});

test('Network failure and sensitive response fields do not leak into records', async () => {
  const failed = await sample(async () => { throw new Error('secret-token'); }, () => start);
  assert.equal(failed.ok, false); assert(!JSON.stringify(failed).includes('secret-token'));
  const result = await sample(async () => ({ status: 200, json: async () => ({ ...payload(), privateData: 'client-name' }) }), () => start);
  assert(!JSON.stringify(result).includes('client-name'));
});

test('Observation output cannot escape the ignored local folder', async () => {
  for (const file of ['../outside.jsonl', 'docs/report.jsonl', '.cache/stability/../report.jsonl']) await assert.rejects(safeOutput(file, true));
});
