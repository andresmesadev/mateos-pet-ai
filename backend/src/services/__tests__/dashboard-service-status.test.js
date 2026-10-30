jest.mock('../../lib/prisma', () => ({}));
jest.mock('../whatsapp-route.service', () => ({ outbound: jest.fn() }));
jest.mock('../ai-quota.service', () => ({ status: jest.fn() }));
const { buildDashboardServiceStatus } = require('../dashboard-service-status');
const { recordOpenAIProbe, readOpenAIProbe } = require('../provider-health-observation');

const now = Date.parse('2026-10-30T18:00:00Z');
function fixture(overrides = {}) {
  const db = { tenant: { findUnique: jest.fn(async ({ where }) => ({ id: where.id, active: true })) } };
  const outbound = jest.fn(async () => ({ accessToken: 'NEVER-RETURN-SECRET' }));
  const aiStatus = jest.fn(async () => ({ enabled: true, policyReady: true, configured: true, exhausted: false, pending: [{ id: 'PRIVATE-USAGE' }] }));
  const deps = { db, env: { OPENAI_API_KEY: 'secret' }, clock: () => now, outbound, aiStatus, worker: () => ({ healthy: true }), probe: () => null, ...overrides };
  return { ...deps, status: buildDashboardServiceStatus(deps) };
}
test('reads only the authenticated tenant, returns no credentials or private usage, performs no provider call', async () => {
  const f = fixture();
  const result = await f.status('own');
  expect(f.db.tenant.findUnique).toHaveBeenCalledWith({ where: { id: 'own' }, select: { id: true, active: true } });
  expect(f.outbound).toHaveBeenCalledWith('own'); expect(f.aiStatus).toHaveBeenCalledWith('own');
  expect(result).toEqual({ tenantId: 'own', checkedAt: new Date(now).toISOString(), dashboard: { state: 'responding' }, whatsapp: { state: 'configured' }, ai: { state: 'unverified', observedAt: null } });
  expect(JSON.stringify(result)).not.toMatch(/SECRET|PRIVATE-USAGE/);
});
test('requires a concrete active tenant before reading dependencies', async () => {
  const f = fixture(); await expect(f.status(null)).rejects.toMatchObject({ status: 403 });
  f.db.tenant.findUnique.mockResolvedValue(null);
  await expect(f.status('missing')).rejects.toMatchObject({ status: 403 });
  expect(f.outbound).not.toHaveBeenCalled(); expect(f.aiStatus).not.toHaveBeenCalled();
});
test('pause takes precedence and never resolves a route', async () => {
  const f = fixture({ env: { WHATSAPP_ENABLED: 'false' } });
  const result = await f.status('own'); expect(result.whatsapp.state).toBe('paused');
  expect(f.outbound).not.toHaveBeenCalled(); expect(result.ai.state).toBe('not_configured');
});
test.each([
  [null, true, 'unavailable'], [{}, false, 'worker_degraded'],
])('distinguishes absent route and failed worker', async (route, healthy, state) => {
  expect((await fixture({ outbound: async () => route, worker: () => ({ healthy }) }).status('own')).whatsapp.state).toBe(state);
});
test.each([
  [{ enabled: true, policyReady: false }, 'policy_pending'],
  [{ enabled: true, policyReady: true, configured: false }, 'quota_pending'],
  [{ enabled: true, policyReady: true, configured: true, exhausted: true }, 'exhausted'],
])('explains the actual quota blocker without claiming a provider failure', async (quota, state) => {
  expect((await fixture({ aiStatus: async () => quota }).status('own')).ai.state).toBe(state);
});
test('partial failures preserve other signals and recovery replaces the error', async () => {
  const f = fixture(); f.outbound.mockRejectedValueOnce(Error('private detail')); f.aiStatus.mockRejectedValueOnce(Error('private detail'));
  expect(await f.status('own')).toMatchObject({ dashboard: { state: 'responding' }, whatsapp: { state: 'unknown' }, ai: { state: 'unknown' } });
  expect(await f.status('own')).toMatchObject({ whatsapp: { state: 'configured' }, ai: { state: 'unverified' } });
});
test('only fresh probe evidence supports an observed outcome; does not survive stale/future clocks', async () => {
  recordOpenAIProbe(false, now);
  expect(readOpenAIProbe(now).ok).toBe(false);
  expect(readOpenAIProbe(now + 600001)).toBe(null); expect(readOpenAIProbe(now - 1)).toBe(null);
  expect((await fixture({ probe: readOpenAIProbe }).status('own')).ai.state).toBe('degraded');
  recordOpenAIProbe(true, now);
  expect((await fixture({ probe: readOpenAIProbe }).status('own')).ai.state).toBe('observed_ok');
});
