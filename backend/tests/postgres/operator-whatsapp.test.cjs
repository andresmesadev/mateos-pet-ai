const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const connectionString = process.env.OPERATIONAL_TEST_DATABASE_URL;
if (!connectionString) throw Error('Set OPERATIONAL_TEST_DATABASE_URL explicitly; never use DATABASE_URL');
const url = new URL(connectionString);
if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.port !== '55432' || !/^operational_test[\w-]*$/.test(url.pathname.slice(1))) throw Error('Disposable localhost:55432 operational_test database required');
const pool = new Pool({ connectionString, max: 12, options: '-c timezone=UTC' });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
require.cache[require.resolve('../../src/lib/prisma')] = { exports: prisma };
const p = require('../../src/application/operator-channel/protocol');
const { buildOperatorAuthority } = require('../../src/application/operator-channel/authority');
const { buildOperatorLinking } = require('../../src/application/operator-channel/linking');
const { buildOperatorSessions } = require('../../src/application/operator-channel/sessions');
const { buildOperatorAccess } = require('../../src/application/operator-channel/access');
const { parseOperatorInputs } = require('../../src/application/operator-channel/ingress');
const { buildOperatorChannel } = require('../../src/application/operator-channel');
const { buildOperatorMaintenance } = require('../../src/application/operator-channel/maintenance');
const { PrismaInventoryAccessReader } = require('../../src/contexts/inventory/infrastructure/prisma-access.reader');
const { buildOperationalContext } = require('../../src/contexts/agents/operational');
const { buildInventoryContext } = require('../../src/contexts/inventory');
const { PrismaUnitOfWork } = require('../../src/contexts/shared/persistence/prisma-unit-of-work');
const finance = require('../../src/contexts/finance');
const { buildOperatorCoordinator } = require('../../src/application/operator-channel/coordinator');
const { buildOperatorDelivery } = require('../../src/contexts/communication/application/use-cases/operator-delivery');
const queue = require('../../src/services/inbound-job.service');
const settings = { enabled: true, key: randomBytes(40).toString('hex'), keyVersion: 'test-v1' };
after(async () => { await prisma.$disconnect(); await pool.end(); });

test('fresh registration retries recover one receipt after TTL and cannot resurrect a superseded boot', async () => {
  let at = new Date();
  const authority = buildOperatorAuthority({ prisma, settings, clock: () => at });
  const row = await prisma.operatorAuthority.findUnique({ where: { issuer: 'dashboard-admin' } });
  const body = { bootId: randomUUID(), expectedEpoch: String(row?.epoch || 0), principalKey: 'admin:recovery@example.test', credentialGeneration: p.digest('recovery'), state: 'active' };
  const original = p.sign(settings.key, settings.keyVersion, 'register_issuer', body, 30000, at);
  const first = p.verify(settings.key, settings.keyVersion, await authority.register(original), 'register_issuer_reply', 30000, at);
  at = new Date(+at + 31000);
  await assert.rejects(authority.register(original));
  const renewed = p.sign(settings.key, settings.keyVersion, 'register_issuer', body, 30000, at, original.operationId);
  const recovered = p.verify(settings.key, settings.keyVersion, await authority.register(renewed), 'register_issuer_reply', 30000, at);
  assert.equal(recovered.body.epoch, first.body.epoch);
  assert.equal(await prisma.operatorProof.count({ where: { kind: 'issuer_register', operationId: original.operationId } }), 1);
  await authority.register(p.sign(settings.key, settings.keyVersion, 'register_issuer', { ...body, bootId: randomUUID(), expectedEpoch: recovered.body.epoch }, 30000, at));
  await assert.rejects(authority.register(p.sign(settings.key, settings.keyVersion, 'register_issuer', body, 30000, at, original.operationId)), e => e.code === 'ISSUER_EPOCH_CHANGED');
  await assert.rejects(authority.register(p.sign(settings.key, settings.keyVersion, 'register_issuer', body, 30000, at)), e => e.code === 'ISSUER_EPOCH_CHANGED');
});

test('channel preflight verifies real private HTTP transport and current PostgreSQL authority without Meta', async () => {
  const { createServer } = require('node:http');
  const { checkOperatorChannel } = require('../../src/scripts/check-operator-channel');
  const authority = buildOperatorAuthority({ prisma, settings });
  const previous = await prisma.operatorAuthority.findUnique({ where: { issuer: 'dashboard-admin' } });
  await authority.register(p.sign(settings.key, settings.keyVersion, 'register_issuer', { bootId: randomUUID(), expectedEpoch: String(previous?.epoch || 0),
    principalKey: 'admin:preflight@example.test', credentialGeneration: p.digest('preflight'), state: 'active' }));
  const tenant = await prisma.tenant.create({ data: { name: 'Preflight test', slug: randomUUID(), phone: String(300000000000n + BigInt(Math.floor(Math.random() * 100000000000))) } });
  let tamper = false, calls = 0;
  const server = createServer(async (req, res) => {
    try {
      assert.equal(req.url, '/api/internal/operator-authority');
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const envelope = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const claim = p.verify(settings.key, settings.keyVersion, envelope, 'live_request'); calls++;
      const row = await prisma.operatorAuthority.findUnique({ where: { issuer: 'dashboard-admin' } });
      const reply = p.sign(settings.key, settings.keyVersion, 'access', { ...claim.body, requestHash: p.digest(envelope), authorityId: row.id,
        bootId: row.bootId, epoch: String(row.epoch), credentialEpoch: String(row.credentialEpoch), credentialGeneration: row.credentialGeneration, state: 'active' });
      if (tamper) reply.signature = '0'.repeat(64);
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(reply));
    } catch { res.statusCode = 403; res.end('{}'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { OPERATOR_WHATSAPP_ENABLED: 'true', OPERATOR_CHANNEL_HMAC_KEY: settings.key, OPERATOR_CHANNEL_KEY_VERSION: settings.keyVersion,
    OPERATOR_AUTHORITY_URL: `http://127.0.0.1:${server.address().port}/api/internal/operator-authority` };
  try {
    const checked = await checkOperatorChannel({ prisma, env }); assert.equal(checked.status, 'ready'); assert.equal(checked.metaTransport, 'not_tested');
    tamper = true; await assert.rejects(checkOperatorChannel({ prisma, env })); assert.equal(calls, 2);
    assert.equal(await prisma.operatorProof.count({ where: { tenantId: tenant.id, kind: 'live_admin' } }), 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
async function fixture() {
  const receiver = BigInt('100000000000') + BigInt(Math.floor(Math.random() * 100000000000));
  const tenant = await prisma.tenant.create({ data: { name: 'Private WhatsApp test', slug: randomUUID(), phone: String(receiver), activeModules: ['veterinary','grooming','retail'] } });
  await prisma.channel.create({ data: { tenantId: tenant.id, type: 'whatsapp' } });
  const staff = await prisma.staff.create({ data: { tenantId: tenant.id, name: 'Operator test', role: 'admin' } });
  await prisma.staffCredential.create({ data: { staffId: staff.id, email: randomUUID() + '@example.test', passwordHash: 'test-only', sessionVersion: 1 } });
  const input = { tenantId: tenant.id, actor: { type: 'admin', staffId: staff.id, sessionVersion: 1, name: staff.name } };
  const routeConfig = () => ({ receiver: String(receiver), hash: p.digest(['route', String(receiver)]) });
  const authority = buildOperatorAuthority({ prisma, settings });
  const accessReader = new PrismaInventoryAccessReader();
  const linking = buildOperatorLinking({ prisma, authority, accessReader, routeConfig });
  const sessions = buildOperatorSessions({ prisma, authority, linking, routeConfig });
  const access = buildOperatorAccess({ prisma, authority, accessReader, routeConfig });
  const financial = await prisma.digitalEmployee.create({ data: { tenantId: tenant.id, specialization: 'asistente_financiero' } });
  const administrative = await prisma.digitalEmployee.create({ data: { tenantId: tenant.id, specialization: 'asistente_administrativo' } });
  const unitOfWork = new PrismaUnitOfWork();
  const inventory = buildInventoryContext({ unitOfWork, eventPublisher: { publish: async () => {} } });
  const interpret = async text => text.startsWith('buscar') ? { intent: 'inventory_search', fields: { search: text.slice(6) } } : text.includes('entrada') ? { intent: 'prepare_entry', fields: JSON.parse(text.slice(text.indexOf('{'))) } : { intent: 'prepare_expense', fields: { amount: '10.00', responsible: staff.name, description: 'Prueba interna', category: 'supplies' } };
  const operational = buildOperationalContext({ prisma, unitOfWork, finance, inventory, interpret, operatorAccess: access });
  const sent = []; let outcome = 'accepted';
  const delivery = buildOperatorDelivery({ prisma, authority, access, routeConfig, provider: async args => { sent.push(args); return outcome === 'accepted' ? { state: 'accepted', messageId: 'out.' + randomUUID() } : { state: outcome }; } });
  const coordinator = buildOperatorCoordinator({ prisma, authority, access, operational, delivery, interpret });
  const phone = '573001234567';
  const proof = (purpose, binding) => p.sign(settings.key, settings.keyVersion, purpose, { tenantId: tenant.id, principalKey: `staff:${staff.id}`, sessionVersion: 1, bindingHash: p.digest(binding) }, 60000);
  async function admit(kind, extra = {}, classifier = sessions, claimAt) {
    const route = await prisma.operatorChannelRoute.findFirst({ where: { tenantId: tenant.id, state: 'enabled' } });
    const envelope = { v: 2, kind, id: 'wamid.' + randomUUID(), receiver: String(receiver), from: phone, timestamp: String(Math.floor(Date.now()/1000)), ...extra };
    const { job } = await queue.enqueueOperatorJob({ route, input: envelope });
    const claimed = await queue.claimNextInboundJob(claimAt || new Date()); assert.equal(claimed.id, job.id);
    return classifier.classify(claimed);
  }
  async function finish(job) { await queue.markInboundJobDone(await queue.checkpointInboundJob(job, 'complete')); }
  async function link() {
    const start = await linking.start(input, { phone, proof: proof('link_start', { phone }) });
    const digest = p.mac(settings.key, 'link-code', { receiver: String(receiver), phone, code: start.code });
    const job = await admit('link', { codeDigest: digest, reserved: true });
    assert.equal(job.replies[0].controlCode, 'link_proved'); await finish(job);
    const active = await linking.activate(input, { challengeId: start.id, proof: proof('link_activate', { challengeId: start.id }) });
    return active;
  }
  async function turn(kind, extra) {
    const job = await admit(kind, extra); const replies = await coordinator.process(job);
    for (const r of replies) assert.equal((await delivery.send(r.deliveryId)).state, 'accepted');
    await finish(job); return { job, replies };
  }
  return { tenant, staff, input, authority, access, linking, sessions, phone, proof, routeConfig, admit, finish, link, operational, coordinator, delivery, sent, turn, financial, administrative, interpret, setOutcome: value => { outcome = value; } };
}
test('linking verifies dashboard + exact phone, then opens an isolated private session', async () => {
  const f = await fixture(); const l = await f.link();
  const job = await f.admit('negocio', { reserved: true });
  assert.equal(job.channelResultKind, 'operator');
  const input = await f.access.identity(job.channelSessionId);
  await prisma.$transaction(async tx => { const checked = await f.access.check(input, { tx }); assert.equal(checked.link.id, l.id); });
  assert.equal(await prisma.user.count({ where: { tenantId: f.tenant.id } }), 0);
  assert.equal(await prisma.conversation.count({ where: { tenantId: f.tenant.id } }), 0);
  await f.finish(job);
});
test('linking code is sanitized before queue persistence, including malformed commands', () => {
  const body = text => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '12345' }, messages: [{ id: 'wamid.1', from: '573001234567', type: 'text', text: { body: text } }] } }] }] });
  for (const text of ['/vincular ABCDEF1234', 'mira /vincular SECRETO999', '/vincular incorrecto']) {
    const result = parseOperatorInputs(body(text), settings);
    assert.equal(result[0].kind, 'link'); assert.ok(!JSON.stringify(result).includes(text)); assert.ok(!JSON.stringify(result).includes('ABCDEF1234'));
  }
});
test('credential change invalidates existing private access even after restoring the old hash', async () => {
  const f = await fixture(); await f.link(); const job = await f.admit('negocio', { reserved: true }); await f.finish(job);
  const input = await f.access.identity(job.channelSessionId);
  await prisma.staffCredential.update({ where: { staffId: f.staff.id }, data: { passwordHash: 'changed', sessionVersion: 2 } });
  await prisma.staffCredential.update({ where: { staffId: f.staff.id }, data: { passwordHash: 'test-only', sessionVersion: 3 } });
  await assert.rejects(prisma.$transaction(tx => f.access.check(input, { tx })));
  const next = await f.admit('text', { text: 'reporte financiero' });
  assert.equal(next.channelResultKind, 'control'); assert.equal(next.replies[0].controlCode, 'access_denied'); await f.finish(next);
});
test('dashboard proof cannot be replayed or changed to another phone', async () => {
  const f = await fixture(); const proof = f.proof('link_start', { phone: f.phone });
  await f.linking.start(f.input, { phone: f.phone, proof });
  await assert.rejects(f.linking.start(f.input, { phone: f.phone, proof }));
  await assert.rejects(f.linking.start(f.input, { phone: '573009999999', proof }));
});
test('revocation remains blocked until an explicit customer-mode command', async () => {
  const f = await fixture(); const l = await f.link(); const job = await f.admit('negocio', { reserved: true }); await f.finish(job);
  await f.linking.revoke(f.input, l.id);
  const blocked = await f.admit('text', { text: 'hola' }); assert.notEqual(blocked.channelResultKind, 'customer'); await f.finish(blocked);
  const out = await f.admit('clientes', { reserved: true }); assert.equal(out.replies[0].controlCode, 'customer_mode'); await f.finish(out);
  const client = await f.admit('text', { text: 'hola' }); assert.equal(client.channelResultKind, 'customer'); await f.finish(client);
});
test('native WhatsApp confirmation and concurrent dashboard confirmation share one expense receipt', async () => {
  const f = await fixture(); await f.link(); await f.turn('negocio', { reserved: true }); await f.turn('text', { text: 'finanzas' });
  await f.turn('text', { text: 'preparar gasto' });
  const i = await prisma.operatorInteraction.findFirst({ where: { tenantId: f.tenant.id, kind: 'confirm' } }); assert.equal(i.state, 'offered');
  const token = f.sent.at(-1).buttons[0].token;
  const job = await f.admit('interaction', { tokenDigest: p.mac(settings.key, 'interaction-token', token), contextId: i.providerMessageId, forwarded: false });
  await Promise.all([f.coordinator.process(job), f.operational.confirm(f.input, i.actionId, i.expectedRevision)]);
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 1);
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: i.actionId } }), 1);
  await f.finish(job);
  const replay = await f.admit('interaction', { tokenDigest: p.mac(settings.key, 'interaction-token', token), contextId: i.providerMessageId, forwarded: false });
  await f.coordinator.process(replay); await f.finish(replay);
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 1);
});
test('plain yes, missing native context and forwarded button cannot confirm an operation', async () => {
  const f = await fixture(); await f.link(); await f.turn('negocio', { reserved: true }); await f.turn('text', { text: 'finanzas' }); await f.turn('text', { text: 'gasto' });
  const i = await prisma.operatorInteraction.findFirst({ where: { tenantId: f.tenant.id } }); const token = f.sent.at(-1).buttons[0].token;
  await f.turn('text', { text: 'sí' });
  await f.turn('interaction', { tokenDigest: p.mac(settings.key, 'interaction-token', token), contextId: null });
  await f.turn('interaction', { tokenDigest: p.mac(settings.key, 'interaction-token', token), contextId: i.providerMessageId, forwarded: true });
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 0);
});
test('private sending timeout is durable and never automatically resent', async () => {
  const f = await fixture(); await f.link(); const job = await f.admit('negocio', { reserved: true }); const replies = await f.coordinator.process(job);
  f.setOutcome('uncertain'); const id = replies[0].deliveryId;
  assert.equal((await f.delivery.send(id)).state, 'uncertain');
  assert.equal((await f.delivery.send(id)).state, 'uncertain');
  assert.equal(f.sent.length, 1); await f.finish(job);
});
test('revocation before private delivery blocks the pending message', async () => {
  const f = await fixture(); const l = await f.link(); const job = await f.admit('negocio', { reserved: true }); const replies = await f.coordinator.process(job);
  await f.linking.revoke(f.input, l.id);
  assert.equal((await f.delivery.send(replies[0].deliveryId)).state, 'blocked'); assert.equal(f.sent.length, 0); await f.finish(job);
});
test('native inventory confirmation creates one stock entry and one receipt', async () => {
  const f = await fixture(); await f.link(); await f.turn('negocio', { reserved: true }); await f.turn('text', { text: 'inventario' });
  const code = randomUUID(); const product = await prisma.inventoryProduct.create({ data: { tenantId: f.tenant.id, name: 'Insumo test', category: 'supplies', internalCode: code, internalCodeKey: code,
    presentation: 'Unidad', uses: ['retail'], referenceCost: '1.00', salePrice: '2.00', stockMinimum: 0, lotPolicy: 'untracked' } });
  await f.turn('text', { text: 'entrada ' + JSON.stringify({ productId: product.id, quantity: 3, unitCost: '2.00' }) });
  const i = await prisma.operatorInteraction.findFirst({ where: { tenantId: f.tenant.id, kind: 'confirm' } }); const token = f.sent.at(-1).buttons[0].token;
  await f.turn('interaction', { tokenDigest: p.mac(settings.key, 'interaction-token', token), contextId: i.providerMessageId });
  const receipt = await prisma.executionReceipt.findFirst({ where: { actionId: i.actionId } }); assert.ok(receipt.inventoryOperationId);
  assert.equal(await prisma.inventoryMovement.count({ where: { tenantId: f.tenant.id, productId: product.id } }), 1);
  assert.equal((await prisma.operatorInteraction.findUnique({ where: { id: i.id } })).receiptId, receipt.id);
});

for (const intent of ['prepare_expense', 'prepare_entry']) test(`long ${intent} previews remain complete in dashboard without offering a WhatsApp button`, async () => {
  const f = await fixture(); await f.link(); await f.turn('negocio', { reserved: true });
  const long = intent === 'prepare_expense' ? '🐾'.repeat(1200) : 'á'.repeat(1000);
  let fields = { amount: '10.00', responsible: f.staff.name, description: long };
  if (intent === 'prepare_entry') {
    const code = randomUUID();
    const product = await prisma.inventoryProduct.create({ data: { tenantId: f.tenant.id, name: 'Insumo', category: 'supplies', internalCode: code, internalCodeKey: code,
      presentation: 'Unidad', uses: ['retail'], referenceCost: '1.00', salePrice: '2.00', stockMinimum: 0, lotPolicy: 'untracked' } });
    fields = { productId: product.id, quantity: 1, unitCost: '1.00', reason: long };
  }
  const employee = intent === 'prepare_expense' ? f.financial : f.administrative;
  const prepared = await f.operational.request(f.input, employee.id, { requestId: randomUUID(), intent, fields });
  assert.equal(prepared.action.state, 'lista');
  const { job } = await f.turn('text', { text: '/propuesta ' + prepared.action.id });
  assert.match(f.sent.at(-1).text, /dashboard/); assert.equal(f.sent.at(-1).buttons.length, 0);
  const stored = await f.operational.getAction(f.input, prepared.action.id);
  assert.equal(stored.payload[intent === 'prepare_expense' ? 'description' : 'reason'], long);
  assert.equal(stored.revision, prepared.action.revision);
  assert.equal((await prisma.operatorThread.findFirst({ where: { tenantId: f.tenant.id } })).selectedActionId, stored.id);
  assert.equal(await prisma.operatorInteraction.count({ where: { tenantId: f.tenant.id } }), 0);
  const response = await prisma.operatorDelivery.findFirst({ where: { sourceJobId: job.id } });
  assert.equal(response.kind, 'control'); assert.equal(response.messageId, null);
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: stored.id } }), 0);
  const confirmed = await f.operational.confirm(f.input, stored.id, stored.revision);
  assert.ok(confirmed.receipt); // The exact full proposal remains usable in the dashboard.
});
test('correction creates an immutable new revision and invalidates the old button', async () => {
  const f = await fixture(); await f.link(); await f.turn('negocio', { reserved: true }); await f.turn('text', { text: 'finanzas' }); await f.turn('text', { text: 'gasto' });
  const old = await prisma.operatorInteraction.findFirst({ where: { tenantId: f.tenant.id } }); const token = f.sent.at(-1).buttons[0].token;
  await f.turn('text', { text: 'corregir {"amount":"25.00"}' });
  const row = await prisma.operationalAction.findUnique({ where: { id: old.actionId } }); assert.equal(row.currentRevision, 2);
  const job = await f.admit('interaction', { tokenDigest: p.mac(settings.key, 'interaction-token', token), contextId: old.providerMessageId });
  await assert.rejects(f.coordinator.process(job)); await f.finish(job);
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 0);
});
test('idle expiration stays private and explicit reentry invalidates previous-session buttons', async () => {
  const f = await fixture(); await f.link(); await f.turn('negocio', { reserved: true }); await f.turn('text', { text: 'finanzas' }); await f.turn('text', { text: 'gasto' });
  const old = await prisma.operatorInteraction.findFirst({ where: { tenantId: f.tenant.id } }); const token = f.sent.at(-1).buttons[0].token;
  const expired = buildOperatorSessions({ prisma, authority: f.authority, linking: f.linking, routeConfig: f.routeConfig, clock: () => new Date(Date.now()+16*60000) });
  const blocked = await f.admit('text', { text: 'hola' }, expired, new Date(Date.now()+16*60000)); assert.equal(blocked.channelResultKind, 'control'); assert.equal(blocked.replies[0].controlCode, 'session_expired'); await f.finish(blocked);
  const reentry = await f.admit('negocio', { reserved: true }); assert.equal(reentry.channelResultKind, 'operator'); assert.notEqual(reentry.channelSessionId, old.sessionId); await f.finish(reentry);
  await f.turn('interaction', { tokenDigest: p.mac(settings.key,'interaction-token',token), contextId: old.providerMessageId });
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 0);
});
test('uncertain predecessor blocks only its own participant until explicit dashboard review', async () => {
  const f = await fixture(); await f.link(); const job = await f.admit('negocio', { reserved: true });
  const processing = await queue.checkpointInboundJob(job, 'processing');
  await queue.markInboundJobFailed(processing, new Error('secret-not-to-persist'));
  const failed = await prisma.inboundJob.findUnique({ where: { id: job.id } }); assert.equal(failed.status, 'needs_review'); assert.ok(!failed.lastError.includes('secret-not-to-persist'));
  const r = await prisma.operatorChannelRoute.findFirst({ where: { tenantId: f.tenant.id } });
  const next = await queue.enqueueOperatorJob({ route: r, input: { v:2,kind:'text',id:'wamid.'+randomUUID(),receiver:r.receiver,from:f.phone,text:'hola',timestamp:'1' } });
  assert.equal(await queue.claimNextInboundJob(), null);
  assert.ok((await f.linking.status(f.input)).issues.some(i=>i.id===job.id));
  await f.linking.acknowledge(f.input, { jobId: job.id });
  const claimed = await queue.claimNextInboundJob(); assert.equal(claimed.id, next.job.id);
  await f.finish(await f.sessions.classify(claimed));
});
test('SQL rejects altered admissions and private review hashes', async () => {
  const f = await fixture(); await f.link(); const job = await f.admit('negocio', { reserved: true }); await f.finish(job);
  await assert.rejects(prisma.inboundJob.update({ where: { id: job.id }, data: { payload: { password: 'must-not-persist' } } }));
  await assert.rejects(prisma.inboundJob.delete({ where: { id: job.id } }));
  await f.turn('text', { text: 'finanzas' }); await f.turn('text', { text: 'gasto' });
  const review = await prisma.operatorReview.findFirst({ where: { tenantId:f.tenant.id,kind:'basis' } });
  await assert.rejects(prisma.operatorReview.create({ data: { ...review,id:randomUUID(),kind:'display',basisId:review.id,sessionId:job.channelSessionId,messageId:(await prisma.operatorMessage.findFirst({ where:{tenantId:f.tenant.id,direction:'out'},orderBy:{createdAt:'desc'} })).id,previewHash:'0'.repeat(64),expiresAt:new Date(Date.now()+60000) } }));
});
test('admin issuer boot and credential epochs fence stale instances and A→B→A credentials', async () => {
  const authority = buildOperatorAuthority({ prisma, settings });
  const principalKey = 'admin:owner-global@example.test';
  async function register(generation) {
    const prior = await prisma.operatorAuthority.findUnique({ where:{issuer:'dashboard-admin'} });
    const envelope = p.sign(settings.key,settings.keyVersion,'register_issuer',{bootId:randomUUID(),expectedEpoch:String(prior?.epoch||0),principalKey,credentialGeneration:p.digest(generation),state:'active'});
    const reply = p.verify(settings.key,settings.keyVersion,await authority.register(envelope),'register_issuer_reply'); return { envelope, reply:reply.body };
  }
  const a = await register('A'); const restart = await register('A'); assert.equal(restart.reply.credentialEpoch,a.reply.credentialEpoch);
  const b = await register('B'); const restored = await register('A'); assert.equal(BigInt(restored.reply.credentialEpoch),BigInt(b.reply.credentialEpoch)+1n);
  await assert.rejects(authority.register(a.envelope), e => e.code === 'ISSUER_EPOCH_CHANGED');
  assert.equal(String((await prisma.operatorAuthority.findUnique({where:{issuer:'dashboard-admin'}})).epoch),restored.reply.epoch);
});
test('product selection and pagination use exact native context without replacing the action', async () => {
  const f = await fixture(); await f.link(); await f.turn('negocio',{reserved:true}); await f.turn('text',{text:'inventario'});
  for (let n=0;n<3;n++) { const code=randomUUID(); await prisma.inventoryProduct.create({data:{tenantId:f.tenant.id,name:'Elegible '+n,category:'supplies',internalCode:code,internalCodeKey:code,presentation:'Unidad',uses:['retail'],referenceCost:'1.00',salePrice:'2.00',stockMinimum:0,lotPolicy:'untracked'}}); }
  await f.turn('text',{text:'entrada '+JSON.stringify({quantity:2,unitCost:'2.00'})});
  const original=await prisma.operationalAction.findFirst({where:{tenantId:f.tenant.id}});
  await f.turn('text',{text:'buscar Elegible'});
  const choices=await prisma.operatorInteraction.findMany({where:{tenantId:f.tenant.id,state:'offered'}});
  const more=choices.find(i=>i.kind==='continue'); assert.ok(more); assert.equal(choices.filter(i=>i.kind==='select_product').length,2);
  async function click(i) { return f.turn('interaction',{tokenDigest:p.mac(settings.key,'interaction-token',`op1.${p.mac(settings.key,'outgoing-button',i.id)}`),contextId:i.providerMessageId}); }
  await click(more); const count=await prisma.operationalRequest.count({where:{tenantId:f.tenant.id}}); await click(more);
  assert.equal(await prisma.operationalRequest.count({where:{tenantId:f.tenant.id}}),count);
  const selection=choices.find(i=>i.kind==='select_product'); await click(selection);
  const action=await prisma.operationalAction.findUnique({where:{id:original.id},include:{current:true}});
  assert.equal(action.currentRevision,2); assert.equal(action.executionKey,original.executionKey); assert.equal(action.current.payload.productId,selection.productId);
  assert.equal(await prisma.inventoryMovement.count({where:{tenantId:f.tenant.id}}),0);
});
test('global admin is verified through a fresh private RPC and never needs a synthetic staff identity', async () => {
  const f=await fixture(); const principalKey='admin:owner-channel@example.test';
  const prior=await prisma.operatorAuthority.findUnique({where:{issuer:'dashboard-admin'}});
  await f.authority.register(p.sign(settings.key,settings.keyVersion,'register_issuer',{bootId:randomUUID(),expectedEpoch:String(prior?.epoch||0),principalKey,credentialGeneration:p.digest(settings.key),state:'active'}));
  let available=true; let calls=0;
  const authority=buildOperatorAuthority({prisma,settings,issuerUrl:'http://frontend.internal/api/internal/operator-authority',fetcher:async (_url,options)=>{
    calls++; if(!available) throw Error('offline'); const request=JSON.parse(options.body); const claim=p.verify(settings.key,settings.keyVersion,request,'live_request');
    const row=await prisma.operatorAuthority.findUnique({where:{issuer:'dashboard-admin'}});
    return {ok:true,json:async()=>p.sign(settings.key,settings.keyVersion,claim.body.purpose,{requestHash:p.digest(request),tenantId:f.tenant.id,principalKey,sessionId:claim.body.sessionId,
      authorityId:row.id,epoch:String(row.epoch),credentialEpoch:String(row.credentialEpoch),credentialGeneration:row.credentialGeneration,bootId:row.bootId,state:'active'})};
  }});
  const reader=new PrismaInventoryAccessReader(); const linking=buildOperatorLinking({prisma,authority,accessReader:reader,routeConfig:f.routeConfig});
  const sessions=buildOperatorSessions({prisma,authority,linking,routeConfig:f.routeConfig}); const access=buildOperatorAccess({prisma,authority,accessReader:reader,routeConfig:f.routeConfig});
  const input={tenantId:f.tenant.id,actor:{type:'admin',email:principalKey.slice(6),name:'Owner'}};
  async function proof(purpose,binding){const row=await prisma.operatorAuthority.findUnique({where:{issuer:'dashboard-admin'}});return p.sign(settings.key,settings.keyVersion,purpose,{tenantId:f.tenant.id,principalKey,bindingHash:p.digest(binding),epoch:String(row.epoch),credentialEpoch:String(row.credentialEpoch),credentialGeneration:row.credentialGeneration},60000);}
  const started=await linking.start(input,{phone:f.phone,proof:await proof('link_start',{phone:f.phone})});
  const proved=await f.admit('link',{codeDigest:p.mac(settings.key,'link-code',{receiver:f.routeConfig().receiver,phone:f.phone,code:started.code}),reserved:true}); await f.finish(proved);
  await linking.activate(input,{challengeId:started.id,proof:await proof('link_activate',{challengeId:started.id})});
  const job=await f.admit('negocio',{reserved:true},sessions); assert.equal(job.channelResultKind,'operator');
  const identity=await access.identity(job.channelSessionId); assert.equal(identity.actor.staffId,undefined);
  const live=await access.acquire(identity); await prisma.$transaction(tx=>access.check(identity,{tx,operatorProof:live}));
  const before=calls; available=false; await assert.rejects(access.acquire(identity)); assert.equal(calls,before+1); await f.finish(job);
});
test('signed webhook → durable queue → private employee → native confirmation completes without real transport', async () => {
  const express=require('express'); const request=require('supertest'); const {createHmac}=require('node:crypto');
  const f=await fixture(); const sent=[]; let customerCalls=0;
  const unitOfWork=new PrismaUnitOfWork(); const inventory=buildInventoryContext({unitOfWork,eventPublisher:{publish:async()=>{}}});
  const channel=buildOperatorChannel({prisma,settings,accessReader:inventory.accessReader,env:{WHATSAPP_PHONE_NUMBER_ID:f.routeConfig().receiver,WHATSAPP_ACCESS_TOKEN:'test-only'},
    provider:async args=>{sent.push(args);return {state:'accepted',messageId:'http-out.'+randomUUID()};},
    buildOperational:operatorAccess=>buildOperationalContext({prisma,unitOfWork,finance,inventory,operatorAccess,interpret:f.interpret})});
  const rootPath=require.resolve('../../src/contexts'); const receptionistPath=require.resolve('../../src/contexts/receptionist');
  const oldRoot=require.cache[rootPath], oldReceptionist=require.cache[receptionistPath], oldSecret=process.env.WHATSAPP_APP_SECRET, oldOpenAI=process.env.OPENAI_API_KEY;
  const secret=randomBytes(32).toString('hex'); process.env.WHATSAPP_APP_SECRET=secret;
  process.env.OPENAI_API_KEY='test-only-not-a-real-key';
  require.cache[rootPath]={exports:{operatorChannel:channel,operationalAssistants:channel.operational}};
  require.cache[receptionistPath]={exports:{processIncomingMessage:async()=>{customerCalls++;return null;}}};
  const worker=require('../../src/jobs/inbound-message.job');
  const app=express();app.use('/webhook',express.raw({type:'application/json'}),require('../../src/middleware/parseWebhookBody'),require('../../src/routes/webhook.routes'));
  app.use((error,_req,res,_next)=>res.status(500).json({code:error.code||error.name}));
  async function post(message) {
    const body={object:'whatsapp_business_account',entry:[{changes:[{value:{metadata:{phone_number_id:f.routeConfig().receiver},messages:[{id:'wamid.http.'+randomUUID(),from:f.phone,timestamp:String(Math.floor(Date.now()/1000)),...message}]}}]}]};
    const raw=JSON.stringify(body); const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
    const response=await request(app).post('/webhook').set('Content-Type','application/json').set('X-Hub-Signature-256',signature).send(raw);
    assert.equal(response.status,200,JSON.stringify(response.body)); await worker.drainInboundJobs(); return body.entry[0].changes[0].value.messages[0].id;
  }
  try {
    const started=await channel.linking.start(f.input,{phone:f.phone,proof:f.proof('link_start',{phone:f.phone})});
    const linkId=await post({type:'text',text:{body:started.command}});
    const persisted=await prisma.inboundJob.findUnique({where:{provider_providerEventId:{provider:'whatsapp',providerEventId:linkId}}});
    assert.equal(persisted.status,'done');assert.ok(!JSON.stringify(persisted,(_key,v)=>typeof v==='bigint'?String(v):v).includes(started.code));
    await channel.linking.activate(f.input,{challengeId:started.id,proof:f.proof('link_activate',{challengeId:started.id})});
    await post({type:'text',text:{body:'/negocio'}});await post({type:'text',text:{body:'finanzas'}});await post({type:'text',text:{body:'gasto de prueba'}});
    const button=sent.at(-1).buttons[0];assert.ok(button);
    const interaction=await prisma.operatorInteraction.findUnique({where:{tokenDigest:p.mac(settings.key,'interaction-token',button.token)}});
    await post({type:'interactive',interactive:{type:'button_reply',button_reply:{id:button.token,title:button.title}},context:{id:interaction.providerMessageId}});
    assert.equal(await prisma.expense.count({where:{tenantId:f.tenant.id}}),1);assert.equal(customerCalls,0);
    assert.equal(await prisma.message.count({where:{conversation:{tenantId:f.tenant.id}}}),0);
    await post({type:'text',text:{body:'/clientes'}});await post({type:'text',text:{body:'quiero una cita'}});assert.equal(customerCalls,1);
  } finally {
    await worker.stopInboundMessageJob(); if(oldRoot)require.cache[rootPath]=oldRoot;else delete require.cache[rootPath];if(oldReceptionist)require.cache[receptionistPath]=oldReceptionist;else delete require.cache[receptionistPath];
    if(oldSecret===undefined)delete process.env.WHATSAPP_APP_SECRET;else process.env.WHATSAPP_APP_SECRET=oldSecret;
    if(oldOpenAI===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldOpenAI;
  }
});
test('wrong phone cannot consume attempts and the expected phone is capped at five failed codes', async()=>{
  const f=await fixture(); const started=await f.linking.start(f.input,{phone:f.phone,proof:f.proof('link_start',{phone:f.phone})});
  const other=await f.admit('link',{from:'573009999999',codeDigest:'0'.repeat(64),reserved:true});await f.finish(other);
  assert.equal((await prisma.operatorLinkChallenge.findUnique({where:{id:started.id}})).failedAttempts,0);
  for(let n=0;n<5;n++){const bad=await f.admit('link',{codeDigest:'0'.repeat(64),reserved:true});await f.finish(bad);}
  const exhausted=await prisma.operatorLinkChallenge.findUnique({where:{id:started.id}});assert.equal(exhausted.state,'exhausted');assert.equal(exhausted.failedAttempts,5);
  await assert.rejects(f.linking.activate(f.input,{challengeId:started.id,proof:f.proof('link_activate',{challengeId:started.id})}));
});
test('another account cannot overwrite an active phone link in the same establishment',async()=>{
  const f=await fixture();const link=await f.link();
  const staff=await prisma.staff.create({data:{tenantId:f.tenant.id,name:'Other operator',role:'admin'}});await prisma.staffCredential.create({data:{staffId:staff.id,email:randomUUID()+'@example.test',passwordHash:'test-only'}});
  const input={tenantId:f.tenant.id,actor:{type:'admin',staffId:staff.id,sessionVersion:1}};
  const proof=p.sign(settings.key,settings.keyVersion,'link_start',{tenantId:f.tenant.id,principalKey:'staff:'+staff.id,sessionVersion:1,bindingHash:p.digest({phone:f.phone})},60000);
  await assert.rejects(f.linking.start(input,{phone:f.phone,proof}),e=>e.code==='PHONE_ALREADY_LINKED');
  assert.equal((await prisma.operatorLink.findUnique({where:{id:link.id}})).state,'active');
});
test('restored permissions require a fresh revision before an adopted proposal can execute',async()=>{
  const f=await fixture();await f.link();await f.turn('negocio',{reserved:true});await f.turn('text',{text:'finanzas'});await f.turn('text',{text:'gasto'});
  const action=await prisma.operationalAction.findFirst({where:{tenantId:f.tenant.id}});
  await prisma.staff.update({where:{id:f.staff.id},data:{role:'receptionist'}});await prisma.staff.update({where:{id:f.staff.id},data:{role:'admin'}});
  await assert.rejects(f.operational.confirm(f.input,action.id,1),e=>e.code==='REVIEW_ACCESS_CHANGED');
  const refreshed=await f.operational.refresh(f.input,action.id,1);assert.equal(refreshed.revision,2);await f.turn('text',{text:'/estado'});
  const i=await prisma.operatorInteraction.findFirst({where:{tenantId:f.tenant.id,expectedRevision:2}});
  await f.turn('interaction',{tokenDigest:i.tokenDigest,contextId:i.providerMessageId});assert.equal(await prisma.expense.count({where:{tenantId:f.tenant.id}}),1);
});
test('duplicate business lines are rejected and changing the line blocks a prepared private reply',async()=>{
  const f=await fixture();await f.link();const job=await f.admit('negocio',{reserved:true});const replies=await f.coordinator.process(job);
  await assert.rejects(prisma.tenant.create({data:{name:'Ambiguous receiver test',slug:randomUUID(),phone:f.routeConfig().receiver}}),e=>e.code==='P2002');
  await prisma.tenant.update({where:{id:f.tenant.id},data:{phone:String(BigInt(f.routeConfig().receiver)+1n)}});
  assert.equal((await prisma.operatorChannelRoute.findFirst({where:{tenantId:f.tenant.id}})).state,'disabled');
  assert.equal((await f.delivery.send(replies[0].deliveryId)).state,'blocked');assert.equal(f.sent.length,0);await f.finish(job);
});
test('maintenance quarantines an abandoned send without replay and retains usable link tombstones',async()=>{
  const f=await fixture();const link=await f.link();const job=await f.admit('negocio',{reserved:true});const replies=await f.coordinator.process(job);const id=replies[0].deliveryId;
  await prisma.operatorDelivery.update({where:{id},data:{state:'sending',claimOwner:randomUUID(),claimGeneration:1n,attemptCount:1,claimUntil:new Date(Date.now()-1000)}});
  await buildOperatorMaintenance({prisma})();assert.equal((await prisma.operatorDelivery.findUnique({where:{id}})).state,'uncertain');
  assert.equal((await f.delivery.send(id)).state,'uncertain');assert.equal(f.sent.length,0);
  const row=await prisma.operatorLink.findUnique({where:{id:link.id}});
  await prisma.operatorLinkChallenge.update({where:{id:row.challengeId},data:{codeDigest:null,digestErasedAt:new Date()}});
  const recovered=await f.linking.activate(f.input,{challengeId:row.challengeId});assert.equal(recovered.id,link.id);assert.equal(recovered.state,'active');await f.finish(job);
});
