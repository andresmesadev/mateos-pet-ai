const p = require('../protocol');
const { checkOperatorChannel } = require('../../../scripts/check-operator-channel');
const env = { OPERATOR_WHATSAPP_ENABLED: 'true', OPERATOR_CHANNEL_HMAC_KEY: 'test-only-private-key-'.repeat(3), OPERATOR_CHANNEL_KEY_VERSION: 'v1', OPERATOR_AUTHORITY_URL: 'http://frontend:3001/api/internal/operator-authority' };
const row = { id: 'authority', bootId: 'boot', epoch: 2n, credentialEpoch: 1n, credentialGeneration: p.digest('fake'), principalKey: 'admin:test@example.test', state: 'active' };
const prisma = { operatorAuthority: { findUnique: async () => row }, tenant: { findFirst: async () => ({ id: 'tenant-test' }) } };
function reply(options, patch = {}, key = env.OPERATOR_CHANNEL_HMAC_KEY) {
  const request = JSON.parse(options.body);
  p.verify(key, 'v1', request, 'live_request');
  return { ok: true, json: async () => p.sign(key, 'v1', 'access', { ...row, epoch: '2', credentialEpoch: '1', authorityId: row.id, tenantId: 'tenant-test', sessionId: null, requestHash: p.digest(request), ...patch }) };
}
test('disabled preflight requires neither storage nor network', async () => {
  expect(await checkOperatorChannel({ env: {} })).toEqual({ status: 'disabled' });
});
test('preflight verifies the configured private URL, request correlation and current authority', async () => {
  let url;
  expect((await checkOperatorChannel({ prisma, env, fetcher: async (target, options) => { url = String(target); return reply(options); } })).status).toBe('ready');
  expect(url).toBe(env.OPERATOR_AUTHORITY_URL);
});
test('wrong signatures, old epochs, wrong correlation and unreachable frontend fail closed', async () => {
  for (const patch of [{ epoch: '1' }, { requestHash: p.digest('other') }, { bootId: 'old' }, { state: 'disabled' }]) {
    await expect(checkOperatorChannel({ prisma, env, fetcher: async (_url, options) => reply(options, patch) })).rejects.toThrow();
  }
  await expect(checkOperatorChannel({ prisma, env, fetcher: async () => { throw Error('offline'); } })).rejects.toThrow();
  await expect(checkOperatorChannel({ prisma, env, fetcher: async (_url, options) => {
    const r = reply(options); const body = await r.json(); return { ok: true, json: async () => ({ ...body, signature: '0'.repeat(64) }) };
  } })).rejects.toThrow();
});
