// Refuses every database except the explicitly named disposable Docker fixture.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const target = new URL(process.env.DATABASE_URL || 'http://invalid');
assert.equal(target.protocol, 'postgresql:');
assert.equal(target.hostname, '127.0.0.1');
assert.match(process.env.COMMERCIAL_PROVIDER_TEST_RUN_ID || '', /^huella-final-provider-check-[a-f0-9]{12}$/);
assert.match(process.env.COMMERCIAL_PROVIDER_TEST_PORT || '', /^\d{1,5}$/);
assert.equal(target.port, process.env.COMMERCIAL_PROVIDER_TEST_PORT);
assert.equal(target.pathname, '/huella_provider_check');
assert.equal(target.username, 'provider_test');
const db = require('../../src/lib/prisma');
const { buildAiQuota, monthKey } = require('../../src/services/ai-quota.service');
const { buildWhatsAppConnections } = require('../../src/services/whatsapp-connections.service');
const { buildWhatsAppRoutes } = require('../../src/services/whatsapp-route.service');
const { encryptProviderToken, decryptProviderToken } = require('../../src/services/provider-credential.service');
const { routeSnapshot } = require('../../src/lib/provider-execution');
const env = { WHATSAPP_ENABLED: 'true', WHATSAPP_MULTITENANT_ENABLED: 'true', AI_QUOTA_ENABLED: 'true',
  WHATSAPP_PHONE_NUMBER_ID: '900000', WHATSAPP_ACCESS_TOKEN: 'synthetic-global',
  PROVIDER_CREDENTIAL_KEY: Buffer.alloc(32,7).toString('base64'), AI_QUOTA_POLICY_VERSION: 'test-v1',
  AI_OPERATION_UNITS_JSON: JSON.stringify({ analyze: 1, reply: 1, embedding: 1, transcription: 1, interpret: 1 }) };
const ids = [];
const run = String(Date.now());
const p = value => run + value;
const clock = () => new Date('2026-10-28T20:00:00Z');
async function tenant() {
  const id = randomUUID(); ids.push(id);
  return db.tenant.create({ data: { id, name: 'Synthetic provider test', slug: 'provider-test-' + id } });
}
const quota = (extra = {}) => buildAiQuota({ db, env, clock, ...extra });
const setLimit = (id, n, service = quota()) => service.setLimit({ tenantId: id, monthlyLimit: n, actorKey: 'synthetic-platform-admin' });
async function connected(t, phone, waba = phone + '1', overrides = {}) {
  const meta = { configuration: () => ({ appId: '100', configId: '101', version: 'v25.0' }),
    verify: async () => ({ phoneNumberId: phone, wabaId: waba, token: 'synthetic-token-' + phone, tokenExpiresAt: null, displayPhone: phone }) };
  const service = buildWhatsAppConnections({ db, env, clock, meta, authorize: async () => {}, ...overrides });
  const start = await service.start({ tenantId: t.id, actorKey: 'admin' });
  const input = { tenantId: t.id, actorKey: 'admin', state: start.state, code: 'synthetic-code', wabaId: waba, phoneNumberId: phone };
  return { service, input, start };
}
after(async () => {
  // Audit rows are intentionally immutable. The entire fixture is discarded
  // when its --rm/tmpfs Docker container is stopped; no history is disabled.
  await db.$disconnect();
});

test('twenty simultaneous reservations cannot overspend a quota of two', async () => {
  const t = await tenant(), service = quota(); await setLimit(t.id,2,service);
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_,i) => service.reserve({ tenantId: t.id, operation: 'reply', operationKey: 'parallel-' + i })));
  const yes = results.filter(r => r.status === 'fulfilled'), no = results.filter(r => r.status === 'rejected');
  assert.equal(yes.length,2); assert.equal(no.length,18);
  assert.ok(no.every(r => r.reason.code === 'AI_QUOTA_EXHAUSTED'));
  const status = await service.status(t.id); assert.equal(status.reserved,2); assert.equal(status.used,0); assert.equal(status.remaining,0);
  await Promise.all(Array.from({ length: 8 }, () => service.settle({ tenantId: t.id, entryId: yes[0].value.id, state: 'accepted' })));
  const settled = await service.status(t.id); assert.equal(settled.used,1); assert.equal(settled.reserved,1);
  await assert.rejects(service.reserve({ tenantId: t.id, operation: 'reply', operationKey: yes[0].value.operationKey }), { code: 'AI_OPERATION_ALREADY_RESERVED' });
  await assert.rejects(setLimit(t.id,1,service), { code: 'AI_QUOTA_BELOW_COMMITTED_USAGE' });
});
test('HTTP rejection releases capacity, unknown acceptance reserves it until evidenced reconciliation', async () => {
  const t = await tenant(), service = quota(); await setLimit(t.id,2,service);
  let calls = 0;
  await assert.rejects(service.execute({ tenantId: t.id, operation: 'reply' }, async options => { assert.equal(options.maxRetries,0); calls++; throw Object.assign(Error('rejected'),{ status: 429 }); }));
  assert.equal((await service.status(t.id)).reserved,0);
  await assert.rejects(service.execute({ tenantId: t.id, operation: 'reply' }, async () => { calls++; throw Error('timeout'); }));
  const pending = await service.status(t.id); assert.equal(pending.reserved,1); assert.equal(pending.pending.length,1); assert.equal(calls,2);
  await assert.rejects(service.reconcile({ tenantId: t.id, entryId: pending.pending[0].id, accepted: false, receiptRef: '', actorKey: 'admin' }), { code: 'AI_RECONCILIATION_EVIDENCE_REQUIRED' });
  await service.reconcile({ tenantId: t.id, entryId: pending.pending[0].id, accepted: false, receiptRef: 'synthetic-provider-export-1', actorKey: 'admin' });
  assert.equal((await service.status(t.id)).reserved,0);
});
test('all five operations record safe usage; exhaustion never calls a provider', async () => {
  const t = await tenant(), service = quota(); await setLimit(t.id,5,service);
  for (const operation of ['analyze','reply','embedding','transcription','interpret']) {
    await service.execute({ tenantId: t.id, operation, ...(operation === 'transcription' ? { durationSeconds: 1 } : {}) }, async () => ({ model: 'synthetic', duration: 1, usage: { total_tokens: 12 }, choices: [{ message: { content: 'private content must not persist' } }] }));
  }
  let called = false;
  await assert.rejects(service.execute({ tenantId: t.id, operation: 'reply' }, async () => { called = true; }), { code: 'AI_QUOTA_EXHAUSTED' }); assert.equal(called,false);
  const rows = await db.aiUsageEntry.findMany({ where: { tenantId: t.id } });
  assert.equal(rows.length,5); assert.ok(rows.every(r => r.providerUsage.total_tokens === 12)); assert.ok(!JSON.stringify(rows).includes('private content'));
});
test('a crashed reservation remains committed and becomes reviewable without automatic refunds', async () => {
  const t = await tenant(), initial = quota(); await setLimit(t.id,1,initial);
  const entry = await initial.reserve({ tenantId: t.id, operation: 'reply' });
  // Simulates the original process disappearing before recording a result.
  await db.aiUsageEntry.update({ where: { id: entry.id }, data: { createdAt: new Date('2026-10-28T20:00:00Z') } });
  await assert.rejects(initial.reconcile({ tenantId: t.id, entryId: entry.id, accepted: false, receiptRef: 'synthetic-proof', actorKey: 'admin' }), { code: 'AI_USAGE_NOT_PENDING' });
  const later = quota({ clock: () => new Date('2026-10-28T20:16:00Z') });
  const status = await later.status(t.id); assert.equal(status.reserved,1); assert.equal(status.remaining,0); assert.equal(status.pending[0].id,entry.id);
  await later.reconcile({ tenantId: t.id, entryId: entry.id, accepted: true, receiptRef: 'synthetic-provider-accepted', actorKey: 'admin' });
  assert.equal((await later.status(t.id)).used,1); assert.equal((await later.status(t.id)).reserved,0);
});
test('missing authority, policy, quota and excessive input fail before provider invocation', async () => {
  const t = await tenant(), service = quota();
  await assert.rejects(service.reserve({ operation: 'reply' }), { code: 'AI_TENANT_REQUIRED' });
  await assert.rejects(service.reserve({ tenantId: t.id, operation: 'reply' }), { code: 'AI_QUOTA_NOT_ASSIGNED' });
  await assert.rejects(service.reserve({ tenantId: t.id, operation: 'embedding', inputBytes: 8001 }), { code: 'AI_INPUT_TOO_LARGE' });
  await assert.rejects(quota({ env: { ...env, AI_OPERATION_UNITS_JSON: '{}' } }).reserve({ tenantId: t.id, operation: 'reply' }), { code: 'AI_QUOTA_POLICY_NOT_CONFIGURED' });
  await setLimit(t.id,1); await db.tenant.update({ where: { id: t.id }, data: { active: false } });
  await assert.rejects(service.reserve({ tenantId: t.id, operation: 'reply' }), { code: 'AI_TENANT_NOT_ENABLED' });
});
test('periods use Colombian month boundaries; a policy change cannot silently reprice an open period', async () => {
  const t = await tenant(); await setLimit(t.id,3);
  const oct = quota({ clock: () => new Date('2026-11-01T04:59:59Z') });
  const nov = quota({ clock: () => new Date('2026-11-01T05:00:00Z') });
  assert.equal(monthKey(new Date('2026-11-01T04:59:59Z')),'2026-10');
  await oct.reserve({ tenantId: t.id, operation: 'reply' }); await nov.reserve({ tenantId: t.id, operation: 'reply' });
  assert.equal((await oct.status(t.id)).reserved,1); assert.equal((await nov.status(t.id)).reserved,1);
  await assert.rejects(quota({ env: { ...env, AI_QUOTA_POLICY_VERSION: 'test-v2' } }).reserve({ tenantId: t.id, operation: 'reply' }), { code: 'AI_QUOTA_POLICY_CHANGED' });
  const changes = await db.aiQuotaChange.findMany({ where: { tenantId: t.id } }); assert.equal(changes[0].newLimit,3); assert.notEqual(changes[0].actorHash,'synthetic-platform-admin');
});
test('physical constraints prevent cross-tenant usage and negative or overdrawn counters', async () => {
  const a = await tenant(), b = await tenant(); await setLimit(a.id,2);
  const entry = await quota().reserve({ tenantId: a.id, operation: 'reply' });
  await assert.rejects(db.aiUsageEntry.create({ data: { id: randomUUID(), tenantId: b.id, periodId: entry.periodId, operation: 'reply', operationKey: 'cross', units: 1, state: 'reserved' } }));
  await assert.rejects(db.aiQuotaPeriod.update({ where: { id: entry.periodId }, data: { usedUnits: 5 } }));
  await assert.rejects(db.aiQuotaPeriod.update({ where: { id: entry.periodId }, data: { reservedUnits: -1 } }));
  await assert.rejects(quota().settle({ tenantId: b.id, entryId: entry.id, state: 'accepted' }), { code: 'AI_USAGE_NOT_FOUND' });
});
test('independent encrypted connections route each tenant and verify WABA membership on ingress', async () => {
  const a = await tenant(), b = await tenant();
  const fa = await connected(a,p('811001')), fb = await connected(b,p('811002'));
  await fa.service.complete(fa.input); await fb.service.complete(fb.input);
  const routes = buildWhatsAppRoutes({ db, env, clock });
  const [ra, rb] = await Promise.all([routes.outbound(a.id),routes.outbound(b.id)]);
  assert.equal(ra.accessToken,'synthetic-token-' + p('811001')); assert.equal(rb.accessToken,'synthetic-token-' + p('811002'));
  assert.notEqual(ra.accessToken,env.WHATSAPP_ACCESS_TOKEN); assert.notEqual(ra.channelId,rb.channelId);
  assert.equal((await routes.receiver(p('811002'),p('8110021'))).tenantId,b.id);
  assert.equal(await routes.receiver(p('811002'),p('8110011')),null);
  assert.equal(await routes.outbound(b.id,routeSnapshot(ra)),null);
  const stored = await db.whatsAppConnection.findUnique({ where: { tenantId: b.id } });
  assert.ok(!stored.encryptedToken.includes(rb.accessToken));
  assert.throws(() => decryptProviderToken(stored.encryptedToken,a.id,stored.id,env));
});
test('authorization challenges are tenant/actor bound, expiring and single-use under concurrency', async () => {
  const a = await tenant(), b = await tenant(), f = await connected(a,p('812001'));
  await assert.rejects(f.service.complete({ ...f.input, tenantId: b.id }), { code: 'CONNECTION_CHALLENGE_EXPIRED' });
  await assert.rejects(f.service.complete({ ...f.input, actorKey: 'other-admin' }), { code: 'CONNECTION_CHALLENGE_EXPIRED' });
  const results = await Promise.allSettled([f.service.complete(f.input),f.service.complete(f.input)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length,1);
  await assert.rejects(f.service.complete(f.input));
  const c = await tenant(), expired = await connected(c,p('812002'),undefined,{ clock: () => new Date('2026-10-28T20:00:00Z') });
  const late = buildWhatsAppConnections({ db, env, clock: () => new Date('2026-10-28T20:11:00Z'), authorize: async () => {} });
  await assert.rejects(late.complete(expired.input), { code: 'CONNECTION_CHALLENGE_EXPIRED' });
});
test('revocation wipes tokens, increments the route and never falls back to global credentials', async () => {
  const t = await tenant(), f = await connected(t,p('813001')); await f.service.complete(f.input);
  const routes = buildWhatsAppRoutes({ db, env: { ...env, WHATSAPP_PHONE_NUMBER_ID: p('813001') }, clock });
  const old = await routes.outbound(t.id);
  await f.service.disconnect({ tenantId: t.id, actorKey: 'admin', expectedVersion: old.routeVersion });
  assert.equal(await routes.outbound(t.id),null); assert.equal(await routes.outbound(t.id,routeSnapshot(old)),null);
  const row = await db.whatsAppConnection.findUnique({ where: { tenantId: t.id } }); assert.equal(row.encryptedToken,null); assert.equal(row.routeVersion,2);
  const events = await db.whatsAppConnectionEvent.findMany({ where: { tenantId: t.id }, orderBy: { createdAt: 'asc' } }); assert.deepEqual(events.map(e => e.action),['connected','disconnected']);
  const again = await connected(t,p('813001')); await again.service.complete(again.input);
  assert.equal((await routes.outbound(t.id)).routeVersion,3); assert.equal(await routes.outbound(t.id,routeSnapshot(old)),null);
});
test('authorization is rechecked after the provider returns, before persistence', async () => {
  const t = await tenant(); let denied = false;
  const meta = { configuration: () => ({}), verify: async () => { denied = true; return { token: 'synthetic', wabaId: p('8140011'), phoneNumberId: p('814001'), displayPhone: null, tokenExpiresAt: null }; } };
  const f = await connected(t,p('814001'),undefined,{ meta, authorize: async () => { if (denied) throw Object.assign(Error('denied'),{ code: 'ADMINISTRATOR_REQUIRED', status: 403 }); } });
  await assert.rejects(f.service.complete(f.input), { code: 'ADMINISTRATOR_REQUIRED' });
  assert.equal(await db.whatsAppConnection.findUnique({ where: { tenantId: t.id } }),null);
});
test('an existing phone or WABA cannot be claimed by another establishment', async () => {
  const a = await tenant(), b = await tenant(); const fa = await connected(a,p('815001')); await fa.service.complete(fa.input);
  const fb = await connected(b,p('815001')); await assert.rejects(fb.service.complete(fb.input), { code: 'NUMBER_ALREADY_CONNECTED' });
  const fc = await connected(b,p('815002'),p('8150011')); await assert.rejects(fc.service.complete(fc.input), { code: 'ACCOUNT_ALREADY_CONNECTED' });
});
test('ciphertext is authenticated and bound to both establishment and connection', () => {
  const encrypted = encryptProviderToken('synthetic-secret','a','c',env);
  assert.equal(decryptProviderToken(encrypted,'a','c',env),'synthetic-secret');
  assert.throws(() => decryptProviderToken(encrypted,'b','c',env));
  assert.throws(() => decryptProviderToken(encrypted,'a','d',env));
  assert.throws(() => decryptProviderToken(encrypted.slice(0,-2)+'AA','a','c',env));
  assert.throws(() => decryptProviderToken(encrypted,'a','c',{ ...env, PROVIDER_CREDENTIAL_KEY: Buffer.alloc(32,8).toString('base64') }));
});

const audioPolicy = { ...env, AI_OPERATION_UNITS_JSON: JSON.stringify({ analyze: 1, reply: 1, embedding: 1, transcription: 5, interpret: 1 }) };
test('concurrent minute-weighted reservations cannot overdraw; repeated settlement consumes once', async () => {
  const t = await tenant(), service = quota({ env: audioPolicy }); await setLimit(t.id,10,service);
  const results = await Promise.allSettled(Array.from({ length: 12 },(_,i) => service.reserve({ tenantId: t.id, operation: 'transcription', durationSeconds: 61, inputBytes: 1024, operationKey: 'audio-parallel-'+i })));
  const accepted = results.filter(r => r.status === 'fulfilled');
  assert.equal(accepted.length,1); assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.code === 'AI_QUOTA_EXHAUSTED'));
  assert.equal((await service.status(t.id)).reserved,10);
  await Promise.all(Array.from({ length: 6 },() => service.settle({ tenantId: t.id, entryId: accepted[0].value.id, state: 'accepted' })));
  const status = await service.status(t.id); assert.equal(status.used,10); assert.equal(status.reserved,0);
  const row = await db.aiUsageEntry.findUnique({ where: { id: accepted[0].value.id } });
  assert.deepEqual(row.providerUsage.meter,{ revision: 'm2',basis: 'started_minutes',inputBytes: 1024,quantity: 2,weight: 5,durationMilliseconds: 61000 });
});
test('audio is checked before provider calls; discrepancies remain reserved without replay or refund', async () => {
  const t = await tenant(), service = quota({ env: audioPolicy }); await setLimit(t.id,30,service);
  let calls = 0;
  const invoke = duration => service.execute({ tenantId: t.id, operation: 'transcription', durationSeconds: duration },async () => { calls++; return { duration: 61,text: 'never stored' }; });
  await assert.rejects(invoke(undefined),{ code: 'AI_AUDIO_DURATION_REQUIRED' });
  await assert.rejects(invoke(601),{ code: 'AI_AUDIO_TOO_LONG' }); assert.equal(calls,0);
  await invoke(61); assert.equal((await service.status(t.id)).used,10);
  await assert.rejects(invoke(30),{ code: 'AI_AUDIO_DURATION_UNCONFIRMED' });
  const status = await service.status(t.id); assert.equal(status.reserved,5); assert.equal(status.pending.length,1); assert.equal(calls,2);
  assert.equal(status.pending[0].state,'uncertain');
  const rows = await db.aiUsageEntry.findMany({ where: { tenantId: t.id } }); assert.ok(!JSON.stringify(rows).includes('never stored'));
  assert.equal(rows.find(r => r.state === 'uncertain').providerUsage.failureKind,'audio_duration_unconfirmed');
});
test('a weighted rejection refunds the whole reservation; unknown audio acceptance does not', async () => {
  const t = await tenant(), service = quota({ env: audioPolicy }); await setLimit(t.id,10,service);
  const request = { tenantId: t.id, operation: 'transcription', durationSeconds: 61 };
  await assert.rejects(service.execute(request,async () => { throw Object.assign(Error('rejected'),{ status: 429 }); }));
  assert.equal((await service.status(t.id)).remaining,10);
  await assert.rejects(service.execute(request,async () => { throw Error('timeout'); }));
  assert.equal((await service.status(t.id)).reserved,10);
  let calls = 0;
  await assert.rejects(service.execute(request,async () => { calls++; }),{ code: 'AI_QUOTA_EXHAUSTED' }); assert.equal(calls,0);
});
test('large text consumes multiple blocks, and a weight change cannot reprice an open month', async () => {
  const t = await tenant(), service = quota(); await setLimit(t.id,3,service);
  const entry = await service.reserve({ tenantId: t.id, operation: 'interpret', inputBytes: 4001 }); assert.equal(entry.units,2);
  await assert.rejects(service.reserve({ tenantId: t.id, operation: 'reply', inputBytes: 4001 }),{ code: 'AI_QUOTA_EXHAUSTED' });
  const changed = quota({ env: { ...env,AI_OPERATION_UNITS_JSON: JSON.stringify({ analyze: 1,reply: 2,embedding: 1,transcription: 1,interpret: 1 }) } });
  await assert.rejects(changed.reserve({ tenantId: t.id, operation: 'reply' }),{ code: 'AI_QUOTA_POLICY_CHANGED' });
  assert.equal((await changed.status(t.id)).policyReady,false);
  assert.equal((await service.status(t.id)).reserved,2);
});
