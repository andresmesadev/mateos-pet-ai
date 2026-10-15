// Real PostgreSQL suite. The caller provisions/migrates this disposable database.
// Do not load dotenv or fall back to DATABASE_URL; retain immutable fixture history.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { prismaPoolConfig } = require('../../src/lib/prisma-pool-config');

const connectionString = process.env.OPERATIONAL_TEST_DATABASE_URL;
if (!connectionString) throw new Error('Set OPERATIONAL_TEST_DATABASE_URL explicitly for the disposable operational_test database');
const url = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.port !== '55432' || !/^operational_test(?:[\w-]*)$/.test(url.pathname.slice(1))) {
  throw new Error('Operational tests require localhost:55432 and a database name beginning operational_test');
}
const pool = new Pool({ ...prismaPoolConfig(connectionString), max: 12 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
require.cache[require.resolve('../../src/lib/prisma')] = { exports: prisma };
const { PrismaUnitOfWork } = require('../../src/contexts/shared/persistence/prisma-unit-of-work');
const { PrismaBusinessDayGate } = require('../../src/contexts/shared/persistence/prisma-business-day-gate');
const financeModule = require('../../src/contexts/finance');
const { buildTransactionalFinance } = financeModule;
const { buildInventoryContext } = require('../../src/contexts/inventory');
const { buildOperationalContext } = require('../../src/contexts/agents/operational');
const events = require('../../src/contexts/events');
const { buildOperationalWorker } = require('../../src/contexts/agents/infrastructure/operational/worker');
const { PrismaEventDeliveryRepository } = require('../../src/contexts/events/infrastructure/persistence/prisma-event-delivery.repository');
const { civilDateKey } = require('../../src/contexts/shared/business-day');
const noopPublisher = { publish: async () => {} };
after(async () => { await prisma.$disconnect(); await pool.end(); });

let serial = 0;
async function fixture({ unitOfWork = new PrismaUnitOfWork(), interpret, clock } = {}) {
  const suffix = randomUUID();
  const tenant = await prisma.tenant.create({ data: { name: 'Operational test', slug: 'operational-' + suffix, phone: '+57' + Date.now().toString().slice(-9) + String(++serial).padStart(3, '0'), activeModules: ['veterinary', 'grooming', 'retail'] } });
  const [financial, administrative] = await Promise.all([
    prisma.digitalEmployee.create({ data: { tenantId: tenant.id, specialization: 'asistente_financiero' } }),
    prisma.digitalEmployee.create({ data: { tenantId: tenant.id, specialization: 'asistente_administrativo' } }),
  ]);
  const input = { tenantId: tenant.id, actor: { type: 'admin', email: 'owner@example.test', name: 'Owner' } };
  const finance = buildTransactionalFinance({ unitOfWork, eventPublisher: noopPublisher });
  const inventory = buildInventoryContext({ unitOfWork, eventPublisher: noopPublisher });
  const operational = buildOperationalContext({ prisma, unitOfWork, finance: { ...financeModule, ...finance }, inventory, events,
    interpret: interpret || (async () => { throw new Error('Structured tests must not invoke an external interpreter'); }), ...(clock ? { clock } : {}) });
  return { tenant, financial, administrative, input, finance, inventory, operational };
}
const expenseBody = (overrides = {}) => ({ requestId: randomUUID(), intent: 'prepare_expense', fields: { amount: '10.00', responsible: 'Owner', description: 'Supply', ...overrides } });
async function prepareExpense(f, overrides) { return f.operational.request(f.input, f.financial.id, expenseBody(overrides)); }
function actionOf(result) { assert.ok(result.action?.id, 'request must expose the prepared action'); return result.action; }
function revisionOf(action) { const revision = action.revision ?? action.currentRevision; assert.equal(typeof revision, 'number'); return revision; }
async function product(f) {
  const code = randomUUID();
  return prisma.inventoryProduct.create({ data: { tenantId: f.tenant.id, name: 'Test supplies', category: 'supplies', internalCode: code, internalCodeKey: code, presentation: 'Unidad', uses: ['retail'], referenceCost: '1.00', salePrice: '2.00', stockMinimum: 0, lotPolicy: 'untracked' } });
}
async function prepareEntry(f, p) { return f.operational.request(f.input, f.administrative.id, { requestId: randomUUID(), intent: 'prepare_entry', fields: { productId: p.id, quantity: '3', unitCost: '2.00' } }); }
async function confirm(f, result) { const a = actionOf(result); return f.operational.confirm(f.input, a.id, revisionOf(a)); }
async function waitFor(check, label) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 15)); }
  assert.fail('Timed out: ' + label);
}

test('concurrent identical request UUIDs create one request, task and action', async () => {
  const f = await fixture(); const body = expenseBody();
  const responses = await Promise.all(Array.from({ length: 4 }, () => f.operational.request(f.input, f.financial.id, body)));
  assert.equal(new Set(responses.map(r => r.taskId)).size, 1);
  assert.equal(await prisma.operationalRequest.count({ where: { tenantId: f.tenant.id } }), 1);
  assert.equal(await prisma.agentTask.count({ where: { digitalEmployeeId: f.financial.id } }), 1);
  assert.equal(await prisma.operationalAction.count({ where: { tenantId: f.tenant.id } }), 1);
  await assert.rejects(f.operational.request(f.input, f.financial.id, { ...body, fields: { ...body.fields, amount: '11.00' } }));
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 0);
});

test('two financial confirmations commit one expense, one receipt and one execution decision', async () => {
  const f = await fixture(); const prepared = await prepareExpense(f); const a = actionOf(prepared);
  await Promise.all([confirm(f, prepared), confirm(f, prepared)]);
  const receipts = await prisma.executionReceipt.findMany({ where: { actionId: a.id } });
  assert.equal(receipts.length, 1);
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 1);
  assert.equal((await prisma.agentTask.findUnique({ where: { id: prepared.taskId } })).status, 'completada');
  const receipt = receipts[0];
  assert.ok(receipt.decisionId);
  assert.equal((await prisma.agentDecision.findUnique({ where: { id: receipt.decisionId } })).agentTaskId, prepared.taskId);
  assert.ok(await prisma.publicationIntent.count({ where: { receiptId: receipt.id } }) > 0);
});

test('confirmed operation can be recovered after employee pause without new effects', async () => {
  const f = await fixture(); const prepared = await prepareExpense(f); await confirm(f, prepared);
  const before = await prisma.publicationIntent.count({ where: { tenantId: f.tenant.id } });
  await prisma.digitalEmployee.update({ where: { id: f.financial.id }, data: { status: 'pausado' } });
  await confirm(f, prepared);
  await f.operational.getAction(f.input, actionOf(prepared).id);
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 1);
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: actionOf(prepared).id } }), 1);
  assert.equal(await prisma.publicationIntent.count({ where: { tenantId: f.tenant.id } }), before);
  await assert.rejects(f.operational.request(f.input, f.financial.id, expenseBody()));
});

test('different principal and tenant cannot read or confirm another operator action', async () => {
  const f = await fixture(); const other = await fixture(); const prepared = await prepareExpense(f); const a = actionOf(prepared);
  const input = { ...f.input, actor: { ...f.input.actor, email: 'different@example.test' } };
  await assert.rejects(f.operational.getAction(input, a.id));
  await assert.rejects(f.operational.confirm(input, a.id, revisionOf(a)));
  await assert.rejects(f.operational.getAction(other.input, a.id));
  await assert.rejects(f.operational.confirm(other.input, a.id, revisionOf(a)));
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: a.id } }), 0);
});

test('revoked staff session cannot execute its own prepared operation or recover protected data', async () => {
  const f = await fixture();
  const staff = await prisma.staff.create({ data: { tenantId: f.tenant.id, name: 'Authorized admin', role: 'admin', credential: { create: { email: randomUUID() + '@example.test', passwordHash: 'fixture-not-a-login' } } } });
  const input = { tenantId: f.tenant.id, actor: { type: 'admin', staffId: staff.id, sessionVersion: 1 } };
  const prepared = await f.operational.request(input, f.financial.id, expenseBody());
  await prisma.staffCredential.update({ where: { staffId: staff.id }, data: { active: false, sessionVersion: { increment: 1 } } });
  const a = actionOf(prepared);
  await assert.rejects(f.operational.confirm(input, a.id, a.revision));
  await assert.rejects(f.operational.getAction(input, a.id));
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 0);
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: a.id } }), 0);
});

test('a role change invalidates a saved inventory snapshot and a fresh query removes restricted costs', async () => {
  const f = await fixture(); const p = await product(f);
  const staff = await prisma.staff.create({ data: { tenantId: f.tenant.id, name: 'Changing role', role: 'admin', credential: { create: { email: randomUUID() + '@example.test', passwordHash: 'fixture-not-a-login' } } } });
  const input = { tenantId: f.tenant.id, actor: { type: 'admin', staffId: staff.id, sessionVersion: 1 } };
  const request = () => f.operational.request(input, f.administrative.id, { requestId: randomUUID(), intent: 'inventory_detail', fields: { productId: p.id } });
  const saved = await request(); assert.equal(saved.result.data.referenceCost, 1);
  await prisma.staff.update({ where: { id: staff.id }, data: { role: 'receptionist' } });
  await assert.rejects(f.operational.getTask(input, saved.taskId), error => error.code === 'ACCESS_CHANGED');
  const refreshed = await request(); assert.equal(Object.hasOwn(refreshed.result.data, 'referenceCost'), false);
});

test('a demotion waits for the inventory read and cannot relabel restricted data with new permissions', async () => {
  const f = await fixture(); const p = await product(f);
  const staff = await prisma.staff.create({ data: { tenantId: f.tenant.id, name: 'Concurrent role change', role: 'admin', credential: { create: { email: randomUUID() + '@example.test', passwordHash: 'fixture-not-a-login' } } } });
  const input = { tenantId: f.tenant.id, actor: { type: 'admin', staffId: staff.id, sessionVersion: 1 } };
  let release; let acquired; let held = false;
  const gate = new Promise(resolve => { release = resolve; }); const ready = new Promise(resolve => { acquired = resolve; });
  const detail = f.inventory.reads.detail;
  f.inventory.reads.detail = async (...args) => {
    const result = await detail(...args);
    if (!held) { held = true; assert.equal(result.referenceCost, 1); assert.ok(args[1]?.tx); acquired(); await gate; }
    return result;
  };
  const body = { requestId: randomUUID(), intent: 'inventory_detail', fields: { productId: p.id } };
  const requested = f.operational.request(input, f.administrative.id, body).then(result => ({ result }), error => ({ error }));
  await ready;
  const changed = prisma.staff.update({ where: { id: staff.id }, data: { role: 'receptionist' } }).then(result => ({ result }), error => ({ error }));
  try { await waitFor(async () => (await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%Staff%'")).rowCount > 0, 'demotion waits for the protected inventory read'); }
  finally { release(); }
  const [request, change] = await Promise.all([requested, changed]); assert.ifError(change.error);
  if (request.error) assert.equal(request.error.code, 'ACCESS_CHANGED');
  const saved = await prisma.operationalRequest.findFirst({ where: { tenantId: f.tenant.id, requestId: body.requestId } });
  if (saved.state === 'resuelta') await assert.rejects(f.operational.getTask(input, saved.taskId), error => error.code === 'ACCESS_CHANGED');
  else assert.equal(saved.result, null);
  const fresh = await f.operational.request(input, f.administrative.id, { ...body, requestId: randomUUID() });
  assert.equal(Object.hasOwn(fresh.result.data, 'referenceCost'), false);
});

test('employee pause waits for an authorized confirmation and its committed receipt remains recoverable', async () => {
  const f = await fixture(); const prepared = await prepareExpense(f); const a = actionOf(prepared);
  let release; let acquired; let held = false;
  const gate = new Promise(resolve => { release = resolve; }); const ready = new Promise(resolve => { acquired = resolve; });
  const run = f.operational.store.run;
  f.operational.store.run = fn => run(async ctx => {
    const result = await fn(ctx);
    if (!held && await ctx.tx.executionReceipt.count({ where: { actionId: a.id } })) { held = true; acquired(); await gate; }
    return result;
  });
  const confirmation = confirm(f, prepared); const confirmed = confirmation.then(result => ({ result }), error => ({ error }));
  await ready;
  const pause = prisma.digitalEmployee.update({ where: { id: f.financial.id }, data: { status: 'pausado' } });
  const paused = pause.then(result => ({ result }), error => ({ error }));
  try { await waitFor(async () => (await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%DigitalEmployee%'")).rowCount > 0, 'pause must wait for the employee permission lock'); }
  finally { release(); }
  const [c, p] = await Promise.all([confirmed, paused]); assert.ifError(c.error); assert.ifError(p.error);
  assert.ok((await f.operational.getAction(f.input, a.id)).receipt);
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 1);
  await confirm(f, prepared);
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: a.id } }), 1);
});

test('two inventory confirmations produce one physical entry and receipt', async () => {
  const f = await fixture(); const p = await product(f); const prepared = await prepareEntry(f, p);
  await Promise.all([confirm(f, prepared), confirm(f, prepared)]);
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: actionOf(prepared).id } }), 1);
  const movements = await prisma.inventoryMovement.findMany({ where: { tenantId: f.tenant.id, productId: p.id } });
  assert.equal(movements.length, 1); assert.equal(movements[0].quantity, 3);
  assert.equal((await prisma.inventoryLot.findFirst({ where: { tenantId: f.tenant.id, productId: p.id } })).balancePhysical, 3);
  assert.equal(await prisma.inventoryOperation.count({ where: { tenantId: f.tenant.id, kind: 'register_entry' } }), 1);
});

test('product metadata drift rejects confirmation before stock, audit or receipt is committed', async () => {
  const f = await fixture(); const p = await product(f); const prepared = await prepareEntry(f, p);
  await prisma.inventoryProduct.update({ where: { id: p.id }, data: { metadataVersion: { increment: 1 }, presentation: 'Otra presentación' } });
  await assert.rejects(confirm(f, prepared));
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: actionOf(prepared).id } }), 0);
  assert.equal(await prisma.inventoryMovement.count({ where: { productId: p.id } }), 0);
});

test('transaction failure after business execution rolls back expense, receipt, intents and task terminal state', async () => {
  const f = await fixture(); const prepared = await prepareExpense(f);
  let abort = true; const run = f.operational.store.run;
  f.operational.store.run = fn => run(async ctx => { const result = await fn(ctx); if (abort && await ctx.tx.executionReceipt.count({ where: { actionId: actionOf(prepared).id } })) throw new Error('simulated commit failure'); return result; });
  const before = await prisma.publicationIntent.count({ where: { tenantId: f.tenant.id } });
  await assert.rejects(confirm(f, prepared), /simulated commit failure/);
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 0);
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: actionOf(prepared).id } }), 0);
  assert.equal(await prisma.publicationIntent.count({ where: { tenantId: f.tenant.id } }), before);
  assert.equal((await prisma.agentTask.findUnique({ where: { id: prepared.taskId } })).status, 'en_proceso');
  abort = false; await confirm(f, prepared);
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 1);
});

test('confirmed receipts and revisions are immutable and cannot be transplanted across tenant', async () => {
  const f = await fixture(); const other = await fixture(); const prepared = await prepareExpense(f); await confirm(f, prepared);
  const receipt = await prisma.executionReceipt.findFirst({ where: { actionId: actionOf(prepared).id } });
  await assert.rejects(prisma.executionReceipt.update({ where: { id: receipt.id }, data: { result: { changed: true } } }));
  await assert.rejects(prisma.executionReceipt.delete({ where: { id: receipt.id } }));
  const revision = await prisma.actionRevision.findFirst({ where: { actionId: actionOf(prepared).id } });
  await assert.rejects(prisma.actionRevision.update({ where: { id: revision.id }, data: { payload: { amount: '999' } } }));
  await assert.rejects(prisma.actionRevision.create({ data: { ...revision, id: randomUUID(), tenantId: other.tenant.id, number: revision.number + 1 } }));
  assert.equal(await prisma.executionReceipt.count({ where: { id: receipt.id } }), 1);
});

test('revision replacement requires the new number and executes the immutable revised payload', async () => {
  const f = await fixture(); const prepared = await prepareExpense(f, { amount: '' }); const a = actionOf(prepared);
  assert.equal(a.state, 'borrador');
  const revised = await f.operational.revise(f.input, a.id, revisionOf(a), { amount: '22.00' });
  assert.equal(revised.revision, 2); assert.equal(revised.state, 'lista');
  await assert.rejects(f.operational.confirm(f.input, a.id, 1), error => error.code === 'REVISION_CHANGED');
  await f.operational.confirm(f.input, a.id, revised.revision);
  const receipt = await prisma.executionReceipt.findFirst({ where: { actionId: a.id } });
  assert.equal(receipt.revisionNumber, 2);
  assert.equal(Number((await prisma.expense.findUnique({ where: { id: receipt.expenseId } })).amount), 22);
  assert.equal(await prisma.actionRevision.count({ where: { actionId: a.id } }), 2);
  await assert.rejects(f.operational.revise(f.input, a.id, 2, { amount: '30.00' }));
});

test('inventory confirmation rejects a stale payload even when a concurrent revision matches the supplied number', async () => {
  const f = await fixture(); const p = await product(f); const prepared = await prepareEntry(f, p); const a = actionOf(prepared);
  const entry = f.inventory.commands.entry; let replace = true;
  f.inventory.commands.entry = async (...args) => {
    if (replace) { replace = false; await f.operational.revise(f.input, a.id, 1, { quantity: '7' }); }
    return entry(...args);
  };
  await assert.rejects(f.operational.confirm(f.input, a.id, 2), error => error.code === 'REVISION_CHANGED');
  assert.equal(await prisma.inventoryMovement.count({ where: { productId: p.id } }), 0);
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: a.id } }), 0);
  await f.operational.confirm(f.input, a.id, 2);
  const movements = await prisma.inventoryMovement.findMany({ where: { productId: p.id } });
  assert.equal(movements.length, 1); assert.equal(movements[0].quantity, 7);
  const receipt = await prisma.executionReceipt.findFirst({ where: { actionId: a.id } });
  assert.equal(receipt.revisionNumber, 2);
});

test('a correction cannot merge an old payload into a concurrently advanced revision', async () => {
  const f = await fixture(); const p = await product(f); const prepared = await prepareEntry(f, p); const a = actionOf(prepared);
  const detail = f.inventory.reads.detail; let replace = true;
  f.inventory.reads.detail = async (...args) => {
    if (replace) { replace = false; await f.operational.revise(f.input, a.id, 1, { quantity: '7' }); }
    return detail(...args);
  };
  await assert.rejects(f.operational.revise(f.input, a.id, 2, { unitCost: '9.00' }), error => error.code === 'REVISION_CHANGED');
  const current = await f.operational.getAction(f.input, a.id);
  assert.equal(current.revision, 2); assert.equal(current.payload.quantity, 7); assert.equal(current.payload.unitCost, '2.00');
  const updated = await f.operational.revise(f.input, a.id, 2, { unitCost: '9.00' });
  assert.equal(updated.revision, 3); assert.equal(updated.payload.quantity, 7); assert.equal(updated.payload.unitCost, '9.00');
  assert.equal(await prisma.inventoryMovement.count({ where: { productId: p.id } }), 0);
});

test('discard is terminal, auditable and idempotent without creating a business record', async () => {
  const f = await fixture(); const prepared = await prepareExpense(f); const a = actionOf(prepared);
  const discarded = await f.operational.discard(f.input, a.id, a.revision);
  assert.equal(discarded.state, 'descartada');
  const count = await prisma.agentDecision.count({ where: { agentTaskId: prepared.taskId } });
  await f.operational.discard(f.input, a.id, a.revision);
  assert.equal(await prisma.agentDecision.count({ where: { agentTaskId: prepared.taskId } }), count);
  await assert.rejects(confirm(f, prepared));
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 0);
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: a.id } }), 0);
});

test('expired proposal and an employee paused before confirmation cannot create effects', async () => {
  let time = new Date(); const f = await fixture({ clock: () => new Date(time) });
  const prepared = await prepareExpense(f); const a = actionOf(prepared);
  time = new Date(time.getTime() + 16 * 60000);
  assert.equal((await f.operational.getAction(f.input, a.id)).state, 'vencida');
  await assert.rejects(confirm(f, prepared), error => error.code === 'PROPOSAL_EXPIRED');
  const second = await prepareExpense(f);
  await prisma.digitalEmployee.update({ where: { id: f.financial.id }, data: { status: 'pausado' } });
  await assert.rejects(confirm(f, second), error => error.code === 'EMPLOYEE_PAUSED');
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 0);
});

test('expired interpretation lease can be reclaimed and fences the late original interpreter', async () => {
  let time = new Date(); let calls = 0; let release; let firstStarted;
  const started = new Promise(resolve => { firstStarted = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const interpret = async () => { if (++calls === 1) { firstStarted(); await gate; } return { intent: 'prepare_expense', fields: { amount: '10.00', responsible: 'Owner', description: 'Supply' } }; };
  const f = await fixture({ interpret, clock: () => new Date(time) }); const body = { requestId: randomUUID(), text: 'Prepare supplies expense' };
  const first = f.operational.request(f.input, f.financial.id, body);
  const firstObserved = first.then(result => ({ result }), error => ({ error }));
  await started;
  const previous = await prisma.operationalRequest.findFirst({ where: { tenantId: f.tenant.id } });
  assert.equal(previous.state, 'procesando'); assert.equal(previous.claimGeneration, 1n);
  time = new Date(time.getTime() + 31000);
  const recovered = await f.operational.request(f.input, f.financial.id, body);
  release(); const late = await firstObserved;
  assert.equal(late.error?.code, 'CLAIM_LOST');
  const final = await prisma.operationalRequest.findUnique({ where: { id: previous.id } });
  assert.equal(final.claimGeneration, 2n); assert.equal(final.state, 'resuelta');
  assert.equal(await prisma.operationalAction.count({ where: { requestId: previous.id } }), 1);
  assert.equal(await prisma.agentTask.count({ where: { digitalEmployeeId: f.financial.id } }), 1);
  assert.equal(recovered.taskId, previous.taskId);
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 0);
});

test('inventory rollback includes stock, operation, receipt, intents and task completion', async () => {
  let abort = false; let target; const real = new PrismaUnitOfWork();
  const work = { run: (fn, options) => real.run(async ctx => { const result = await fn(ctx); if (abort && await ctx.tx.executionReceipt.count({ where: { actionId: target } })) throw new Error('inventory commit failure'); return result; }, options) };
  const f = await fixture({ unitOfWork: work }); const p = await product(f); const prepared = await prepareEntry(f, p); target = actionOf(prepared).id;
  const before = await prisma.publicationIntent.count({ where: { tenantId: f.tenant.id } }); abort = true;
  await assert.rejects(confirm(f, prepared), /inventory commit failure/);
  assert.equal(await prisma.inventoryOperation.count({ where: { tenantId: f.tenant.id } }), 0);
  assert.equal(await prisma.inventoryMovement.count({ where: { tenantId: f.tenant.id } }), 0);
  assert.equal(await prisma.inventoryLot.count({ where: { productId: p.id } }), 0);
  assert.equal(await prisma.executionReceipt.count({ where: { actionId: target } }), 0);
  assert.equal(await prisma.publicationIntent.count({ where: { tenantId: f.tenant.id } }), before);
  assert.equal((await prisma.agentTask.findUnique({ where: { id: prepared.taskId } })).status, 'en_proceso');
  abort = false; await confirm(f, prepared);
  assert.equal(await prisma.inventoryMovement.count({ where: { tenantId: f.tenant.id } }), 1);
});

test('three finance queries reuse existing history, close and period reads without business effects', async () => {
  const f = await fixture(); const today = civilDateKey(new Date());
  await f.finance.registerExpense({ tenantId: f.tenant.id, amount: 10, responsible: 'Owner', description: 'Supply' });
  const { dailyClose } = await f.finance.generateDailyClose({ tenantId: f.tenant.id, date: today });
  const label = new Date(today + 'T00:00:00Z');
  const period = await prisma.financialPeriod.create({ data: { tenantId: f.tenant.id, periodStart: label, periodEnd: label, incomeTotal: dailyClose.incomeTotal, expenseTotal: dailyClose.expenseTotal, netAmount: dailyClose.netAmount, breakdown: [] } });
  const history = await f.operational.request(f.input, f.financial.id, { requestId: randomUUID(), intent: 'financial_history', fields: { rangeStart: today, rangeEnd: today } });
  const close = await f.operational.request(f.input, f.financial.id, { requestId: randomUUID(), intent: 'daily_close', fields: { date: today } });
  const report = await f.operational.request(f.input, f.financial.id, { requestId: randomUUID(), intent: 'financial_period', fields: { periodStart: today, periodEnd: today } });
  assert.equal(history.result.data.days[0].dailyClose.id, dailyClose.id);
  assert.equal(close.result.data.dailyClose.id, dailyClose.id);
  assert.equal(report.result.data.financialPeriod.id, period.id);
  for (const response of [history, close, report]) { assert.equal(response.action, null); assert.equal((await prisma.agentTask.findUnique({ where: { id: response.taskId } })).status, 'completada'); }
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 1);
  assert.equal(await prisma.executionReceipt.count({ where: { tenantId: f.tenant.id } }), 0);
});

test('three inventory queries reuse catalogue, detail and movements without modifying stock', async () => {
  const f = await fixture(); const p = await product(f);
  await f.inventory.commands.entry({ ...f.input, kind: 'register_entry', operationKey: randomUUID(), command: { productId: p.id, quantity: 2, unitCost: '1.00' } });
  const catalogue = await f.operational.request(f.input, f.administrative.id, { requestId: randomUUID(), intent: 'inventory_search', fields: { search: p.internalCode } });
  const detail = await f.operational.request(f.input, f.administrative.id, { requestId: randomUUID(), intent: 'inventory_detail', fields: { productId: p.id } });
  const movements = await f.operational.request(f.input, f.administrative.id, { requestId: randomUUID(), intent: 'inventory_movements', fields: { productId: p.id } });
  assert.equal(catalogue.result.data.data[0].id, p.id);
  assert.equal(detail.result.data.id, p.id); assert.equal(detail.result.data.physical, '2');
  assert.equal(movements.result.data.data.length, 1);
  for (const response of [catalogue, detail, movements]) assert.equal(response.action, null);
  assert.equal(await prisma.inventoryMovement.count({ where: { productId: p.id } }), 1);
  assert.equal(await prisma.executionReceipt.count({ where: { tenantId: f.tenant.id } }), 0);
});

test('a missing official close or period is an audited informative query, never a new close', async () => {
  const f = await fixture(); const today = civilDateKey(new Date());
  for (const [intent, fields] of [['daily_close', { date: today }], ['financial_period', { periodStart: today, periodEnd: today }]]) {
    const response = await f.operational.request(f.input, f.financial.id, { requestId: randomUUID(), intent, fields });
    assert.equal(response.action, null); assert.equal(response.result.kind, 'query');
    assert.equal((await prisma.agentTask.findUnique({ where: { id: response.taskId } })).status, 'completada');
  }
  assert.equal(await prisma.dailyClose.count({ where: { tenantId: f.tenant.id } }), 0);
  assert.equal(await prisma.financialPeriod.count({ where: { tenantId: f.tenant.id } }), 0);
  assert.equal(await prisma.executionReceipt.count({ where: { tenantId: f.tenant.id } }), 0);
});

test('database rejects a confirmed action or terminal task without its coherent receipt graph', async () => {
  const f = await fixture(); const prepared = await prepareExpense(f); const a = actionOf(prepared);
  await assert.rejects(prisma.operationalAction.update({ where: { id: a.id }, data: { state: 'confirmada', closedAt: new Date() } }));
  await assert.rejects(prisma.agentTask.update({ where: { id: prepared.taskId }, data: { status: 'completada', result: { v: 1, actionId: a.id, outcome: 'confirmada' } } }));
  assert.equal((await prisma.operationalAction.findUnique({ where: { id: a.id } })).state, 'lista');
  assert.equal((await prisma.agentTask.findUnique({ where: { id: prepared.taskId } })).status, 'en_proceso');
});

test('worker certifies one stable event, records uncertain notification and never invokes it twice', async () => {
  const f = await fixture(); const prepared = await prepareExpense(f); await confirm(f, prepared);
  const candidate = await prisma.publicationIntent.findFirst({ where: { tenantId: f.tenant.id, eventName: 'GastoRegistrado' } });
  let notifications = 0;
  const worker = buildOperationalWorker({ prisma, store: f.operational.store, events: { registerDomainEvent: events.registerDomainEvent, notifyCertifiedEvent: async () => { notifications++; throw new Error('simulated ambiguous delivery'); } } });
  assert.equal(await worker.certify(candidate), true);
  const certified = await prisma.publicationIntent.findUnique({ where: { id: candidate.id } });
  assert.equal(certified.domainEventId, candidate.id);
  assert.equal(await worker.certify(certified), false);
  assert.equal(await prisma.domainEvent.count({ where: { id: candidate.id } }), 1);
  assert.equal(await worker.notify(candidate.id), false);
  assert.equal(await worker.notify(candidate.id), false);
  assert.equal(notifications, 1);
  assert.equal((await prisma.publicationIntent.findUnique({ where: { id: candidate.id } })).notificationState, 'requiere_revision');
  await events.registerEventDelivery({ domainEventId: candidate.id, consumer: 'Automatizaciones', status: 'failed', failureReason: 'uncertain' });
  const { domainEvent: legacy } = await events.registerDomainEvent({ tenantId: f.tenant.id, eventTypeName: 'GastoRegistrado', origin: 'Finanzas', payload: { legacy: true } });
  await events.registerEventDelivery({ domainEventId: legacy.id, consumer: 'Automatizaciones', status: 'failed', failureReason: 'retry allowed' });
  const repo = new PrismaEventDeliveryRepository(); const retry = await repo.findDomainEventsAwaitingRetry('Automatizaciones');
  assert.ok(retry.some(e => e.id === legacy.id)); assert.ok(!retry.some(e => e.id === candidate.id));
  assert.equal(await repo.findLastFailedForConsumer(candidate.id, 'Automatizaciones'), null);
  await assert.rejects(prisma.domainEvent.update({ where: { id: candidate.id }, data: { payload: { changed: true } } }));
});

test('publication SQL guard preserves UTC identity when the transaction uses a non-UTC zone', async () => {
  const f = await fixture(); await prepareExpense(f);
  const candidate = await prisma.publicationIntent.findFirst({ where: { tenantId: f.tenant.id } });
  await f.operational.store.run(async ctx => {
    await ctx.tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'America/Bogota'");
    await events.registerDomainEvent({ id: candidate.id, dispatch: 'deferred', tenantId: candidate.tenantId, eventTypeName: candidate.eventName, origin: candidate.origin, payload: candidate.payload, occurredAt: candidate.occurredAt }, ctx);
    await ctx.tx.publicationIntent.update({ where: { id: candidate.id }, data: { certificationState: 'certificada', domainEventId: candidate.id, certifiedAt: new Date() } });
  });
  const saved = await prisma.publicationIntent.findUnique({ where: { id: candidate.id } });
  const event = await prisma.domainEvent.findUnique({ where: { id: candidate.id } });
  assert.equal(saved.domainEventId, event.id);
  assert.equal(saved.occurredAt.toISOString(), event.occurredAt.toISOString());
});

test('the application pool overrides a non-UTC connection option before Prisma reads timestamptz', async () => {
  const f = await fixture(); await prepareExpense(f);
  const candidate = await prisma.publicationIntent.findFirst({ where: { tenantId: f.tenant.id } });
  const supplied = new URL(connectionString); supplied.searchParams.set('options', '-c timezone=America/Bogota -c application_name=operational_timezone_test');
  const localPool = new Pool(prismaPoolConfig(supplied.toString()));
  const client = new PrismaClient({ adapter: new PrismaPg(localPool) });
  try {
    const setting = await localPool.query('SHOW timezone'); assert.equal(setting.rows[0].TimeZone, 'UTC');
    const row = await client.publicationIntent.findUnique({ where: { id: candidate.id } });
    assert.equal(row.occurredAt.toISOString(), candidate.occurredAt.toISOString());
    assert.equal(row.envelopeHash, candidate.envelopeHash);
  } finally { await client.$disconnect(); await localPool.end(); }
});

test('certification lease expiration before finalization rolls back the certificate and permits a new generation', async () => {
  let time = new Date(); const f = await fixture({ clock: () => new Date(time) }); await prepareExpense(f);
  const candidate = await prisma.publicationIntent.findFirst({ where: { tenantId: f.tenant.id } }); let first = true;
  const worker = buildOperationalWorker({ prisma, store: f.operational.store, events: { registerDomainEvent: async (input, ctx) => {
    const result = await events.registerDomainEvent(input, ctx);
    if (first) { first = false; time = new Date(time.getTime() + 61000); }
    return result;
  }, notifyCertifiedEvent: async () => {} } });
  assert.equal(await worker.certify(candidate), false);
  assert.equal(await prisma.domainEvent.count({ where: { id: candidate.id } }), 0);
  const abandoned = await prisma.publicationIntent.findUnique({ where: { id: candidate.id } });
  assert.equal(abandoned.certificationState, 'pendiente'); assert.equal(abandoned.domainEventId, null);
  assert.equal(await worker.certify(abandoned), true);
  const final = await prisma.publicationIntent.findUnique({ where: { id: candidate.id } });
  assert.equal(final.claimGeneration, 2n); assert.equal(final.domainEventId, candidate.id);
});

test('certification reports no success when its lease expires before the protected read', async () => {
  let time = new Date(); const f = await fixture({ clock: () => new Date(time) }); await prepareExpense(f);
  const candidate = await prisma.publicationIntent.findFirst({ where: { tenantId: f.tenant.id } });
  const run = f.operational.store.run; let transactions = 0;
  f.operational.store.run = fn => run(async ctx => { if (++transactions === 2) time = new Date(time.getTime() + 61000); return fn(ctx); });
  const worker = buildOperationalWorker({ prisma, store: f.operational.store, events });
  assert.equal(await worker.certify(candidate), false);
  assert.equal(await prisma.domainEvent.count({ where: { id: candidate.id } }), 0);
  const expired = await prisma.publicationIntent.findUnique({ where: { id: candidate.id } });
  assert.equal(expired.certificationState, 'pendiente'); assert.equal(expired.domainEventId, null);
  assert.equal(await worker.certify(expired), true);
  assert.equal((await prisma.publicationIntent.findUnique({ where: { id: candidate.id } })).claimGeneration, 2n);
});

test('worker tick expires proposals and quarantines an abandoned notification without replaying it', async () => {
  let time = new Date(); const f = await fixture({ clock: () => new Date(time) });
  const confirmed = await prepareExpense(f); await confirm(f, confirmed);
  const expiring = await prepareExpense(f);
  const candidate = await prisma.publicationIntent.findFirst({ where: { tenantId: f.tenant.id, eventName: 'GastoRegistrado' } });
  const notifications = [];
  // Keep this real-SQL tick scoped to this fixture, preserving other tests' immutable history.
  const scopedModel = model => new Proxy(model, { get(target, method) {
    if (['findMany','updateMany'].includes(method)) return options => target[method]({ ...options, where: { ...options.where, tenantId: f.tenant.id } });
    return target[method];
  } });
  const scoped = new Proxy(prisma, { get(target, name) { return ['publicationIntent','operationalAction'].includes(name) ? scopedModel(target[name]) : target[name]; } });
  const worker = buildOperationalWorker({ prisma: scoped, store: f.operational.store, events: { registerDomainEvent: events.registerDomainEvent, notifyCertifiedEvent: async ({ id }) => {
    notifications.push(id); await events.registerEventDelivery({ domainEventId: id, consumer: 'Automatizaciones', status: 'delivered' });
  } } });
  assert.equal(await worker.certify(candidate), true);
  await prisma.publicationIntent.update({ where: { id: candidate.id }, data: { notificationState: 'iniciada', notificationId: randomUUID(), notificationStarted: time, updatedAt: time } });
  time = new Date(time.getTime() + 16 * 60000);
  await worker.tick();
  assert.equal((await f.operational.getAction(f.input, actionOf(expiring).id)).state, 'vencida');
  const uncertain = await prisma.publicationIntent.findUnique({ where: { id: candidate.id } });
  assert.equal(uncertain.notificationState, 'requiere_revision');
  assert.equal(uncertain.notificationCode, 'PROCESS_RESULT_UNCERTAIN');
  assert.ok(!notifications.includes(candidate.id));
  assert.equal(await worker.notify(candidate.id), false);
  assert.ok(!notifications.includes(candidate.id));
  assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 1);
  assert.equal((await prisma.agentTask.findUnique({ where: { id: expiring.taskId } })).status, 'completada');
});

for (const winner of ['expense', 'close']) test(`Expense/close race with waiting Serializable snapshot: ${winner} commits first`, async () => {
  const f = await fixture(); const realGate = new PrismaBusinessDayGate(); const work = new PrismaUnitOfWork();
  let release; const blocked = new Promise(resolve => { release = resolve; });
  let firstAcquired; const acquired = new Promise(resolve => { firstAcquired = resolve; }); let gates = 0;
  const gate = { acquire: async (...args) => { const first = ++gates === 1; await realGate.acquire(...args); if (first) { firstAcquired(); await blocked; } } };
  const finance = buildTransactionalFinance({ unitOfWork: work, eventPublisher: noopPublisher, businessDayGate: gate });
  const now = new Date(); const expenseInput = { tenantId: f.tenant.id, amount: 10, responsible: 'Owner', description: 'Supply', date: now };
  const closeInput = { tenantId: f.tenant.id, date: civilDateKey(now) };
  const first = winner === 'expense' ? finance.registerExpense(expenseInput) : finance.generateDailyClose(closeInput);
  const firstObserved = first.then(result => ({ result }), error => ({ error }));
  await acquired;
  const second = winner === 'expense' ? finance.generateDailyClose(closeInput) : finance.registerExpense(expenseInput);
  const secondObserved = second.then(result => ({ result }), error => ({ error }));
  try {
    await waitFor(async () => (await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'")).rowCount > 0, 'second command waiting for the same business-day gate');
  } finally { release(); }
  const [a, b] = await Promise.all([firstObserved, secondObserved]);
  assert.ifError(a.error);
  if (winner === 'expense') {
    assert.ifError(b.error); assert.equal(Number(b.result.dailyClose.expenseTotal), 10);
    assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 1);
  } else {
    assert.ok(b.error, 'expense must reject the day that closed first');
    assert.equal(Number(a.result.dailyClose.expenseTotal), 0);
    assert.equal(await prisma.expense.count({ where: { tenantId: f.tenant.id } }), 0);
  }
});

for (const winner of ['void', 'close']) test(`Expense void/close race: ${winner} commits first`, async () => {
  const f = await fixture(); const now = new Date();
  const { expense } = await f.finance.registerExpense({ tenantId: f.tenant.id, amount: 10, responsible: 'Owner', description: 'Supply', date: now });
  const realGate = new PrismaBusinessDayGate(); let release; let firstAcquired; let calls = 0;
  const blocked = new Promise(resolve => { release = resolve; }); const acquired = new Promise(resolve => { firstAcquired = resolve; });
  const gate = { acquire: async (...args) => { const first = ++calls === 1; await realGate.acquire(...args); if (first) { firstAcquired(); await blocked; } } };
  const finance = buildTransactionalFinance({ eventPublisher: noopPublisher, businessDayGate: gate });
  const voidInput = { tenantId: f.tenant.id, expenseId: expense.id, reason: 'Duplicado' };
  const closeInput = { tenantId: f.tenant.id, date: civilDateKey(now) };
  const first = winner === 'void' ? finance.voidExpense(voidInput) : finance.generateDailyClose(closeInput);
  const firstObserved = first.then(result => ({ result }), error => ({ error })); await acquired;
  const second = winner === 'void' ? finance.generateDailyClose(closeInput) : finance.voidExpense(voidInput);
  const secondObserved = second.then(result => ({ result }), error => ({ error }));
  try { await waitFor(async () => (await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'")).rowCount > 0, 'void and close share the daily gate'); }
  finally { release(); }
  const [a, b] = await Promise.all([firstObserved, secondObserved]); assert.ifError(a.error);
  const saved = await prisma.expense.findUnique({ where: { id: expense.id } });
  if (winner === 'void') { assert.ifError(b.error); assert.equal(saved.status, 'voided'); assert.equal(Number(b.result.dailyClose.expenseTotal), 0); }
  else { assert.ok(b.error); assert.equal(saved.status, 'active'); assert.equal(Number(a.result.dailyClose.expenseTotal), 10); }
});
