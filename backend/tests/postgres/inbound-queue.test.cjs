// Real PostgreSQL tests, separate from Jest's global Prisma/OpenAI mocks.
// Never consume DATABASE_URL or dotenv. Use only an explicitly named local DB.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawn } = require('node:child_process');
const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.INBOUND_TEST_DATABASE_URL;
if (!connectionString) throw new Error('Set INBOUND_TEST_DATABASE_URL to a local disposable PostgreSQL database');
const url = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !/test/i.test(url.pathname)) {
  throw new Error('PostgreSQL recovery tests require localhost and a database name containing test');
}
const schema = `inbound_test_${randomUUID().replaceAll('-', '')}`;
const admin = new Pool({ connectionString });
const pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema }) });
// Inject the real, explicitly isolated client before loading the service. This
// prevents lib/prisma from loading dotenv or opening a production connection.
require.cache[require.resolve('../../src/lib/prisma')] = { exports: prisma };
const service = require('../../src/services/inbound-job.service');
let legacyRows;

before(async () => {
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const sql = readFileSync(resolve(__dirname, '../../../prisma/migrations/20260915170000_inbound_job_recovery/migration.sql'), 'utf8');
  // Exercise an existing 8.2 installation as well as the CREATE TABLE path.
  const split = sql.indexOf('ALTER TABLE');
  await pool.query(sql.slice(0, split));
  await pool.query(`INSERT INTO "InboundJob" (id, provider, "providerEventId", payload, status, attempts)
    VALUES ('legacy-claimed','whatsapp','legacy-1','{}','claimed',1),
           ('legacy-retry','whatsapp','legacy-2','{}','received',1),
           ('legacy-new','whatsapp','legacy-3','{}','received',0),
           ('legacy-done','whatsapp','legacy-4','{}','done',1)`);
  await pool.query(sql.slice(split));
  legacyRows = await prisma.inboundJob.findMany({ orderBy: { id: 'asc' } });
});
after(async () => {
  await prisma.$disconnect();
  await pool.end();
  // schema was generated here and never taken from input; no application data.
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await admin.end();
});
beforeEach(async () => { await prisma.inboundJob.deleteMany(); });

const enqueue = async () => (await service.enqueueInboundJob({ provider: 'whatsapp', providerEventId: randomUUID(), payload: { entry: [] } })).job;
const expire = job => prisma.inboundJob.update({ where: { id: job.id }, data: { leaseExpiresAt: new Date(Date.now() - 1000) } });
const reload = job => prisma.inboundJob.findUnique({ where: { id: job.id } });

test('migration quarantines legacy attempts and preserves unprocessed/done jobs', () => {
  assert.deepEqual(legacyRows.map(x => [x.id, x.status, x.phase]), [
    ['legacy-claimed', 'needs_review', 'processing'], ['legacy-done', 'done', 'complete'],
    ['legacy-new', 'received', 'pending'], ['legacy-retry', 'needs_review', 'processing'],
  ]);
});
test('concurrent duplicate webhooks create exactly one job', async () => {
  const input = { provider: 'whatsapp', providerEventId: randomUUID(), payload: {} };
  const results = await Promise.all(Array.from({ length: 8 }, () => service.enqueueInboundJob(input)));
  assert.equal(results.filter(x => x.created).length, 1);
  assert.equal(await prisma.inboundJob.count(), 1);
});
test('concurrent claims cannot acquire the same row twice', async () => {
  await enqueue();
  const claims = await Promise.all(Array.from({ length: 8 }, () => service.claimNextInboundJob()));
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(claims.find(Boolean).attempts, 1);
});
test('abandoned pending job is recovered with durable delay; old owner is fenced', async () => {
  await enqueue();
  const old = await service.claimNextInboundJob();
  await expire(old);
  assert.equal(await service.recoverExpiredInboundJobs(), 1);
  assert.equal(await service.claimNextInboundJob(), null);
  const recovered = await reload(old);
  assert.equal(recovered.status, 'received');
  const next = await service.claimNextInboundJob(recovered.nextAttemptAt);
  assert.equal(next.attempts, 2);
  await assert.rejects(service.checkpointInboundJob(old, 'processing'), service.InboundLeaseLostError);
  assert.equal(await service.markInboundJobFailed(old, 'late error'), null);
  assert.equal((await reload(old)).status, 'claimed');
});
test('heartbeat keeps a live claim out of recovery', async () => {
  await enqueue();
  const job = await service.claimNextInboundJob();
  await service.renewInboundJobLease(job);
  assert.equal(await service.recoverExpiredInboundJobs(), 0);
  assert.equal(await service.claimNextInboundJob(), null);
});
test('expired lease cannot start a new effect, even before another owner claims', async () => {
  await enqueue();
  const job = await service.claimNextInboundJob();
  await expire(job);
  await assert.rejects(service.checkpointInboundJob(job, 'processing'), service.InboundLeaseLostError);
  await assert.rejects(service.renewInboundJobLease(job), service.InboundLeaseLostError);
});
for (const phase of ['processing', 'sending']) {
  test(`crash during ${phase} requires review and cannot replay`, async () => {
    await enqueue();
    const job = await service.claimNextInboundJob();
    await service.checkpointInboundJob(job, phase);
    await expire(job);
    await Promise.all([service.recoverExpiredInboundJobs(), service.recoverExpiredInboundJobs()]);
    assert.equal((await reload(job)).status, 'needs_review');
    assert.equal(await service.claimNextInboundJob(), null);
  });
}
test('ready checkpoint retains reply cursor across recovery', async () => {
  await enqueue();
  const job = await service.claimNextInboundJob();
  const replies = [{ content: 'already delivered' }, { content: 'still pending' }];
  await service.checkpointInboundJob(job, 'ready', { replies, replyCursor: 1 });
  await expire(job);
  await service.recoverExpiredInboundJobs();
  const saved = await reload(job);
  const next = await service.claimNextInboundJob(saved.nextAttemptAt);
  assert.deepEqual(next.replies, replies);
  assert.equal(next.replyCursor, 1);
  assert.equal(next.phase, 'ready');
});
test('abrupt worker exit leaves a durable checkpoint recoverable by a new worker', async () => {
  const original = await enqueue();
  const code = await new Promise((done, reject) => {
    const child = spawn(process.execPath, [resolve(__dirname, 'crash-worker.cjs')], {
      windowsHide: true, stdio: 'ignore',
      env: { ...process.env, INBOUND_TEST_DATABASE_URL: connectionString, INBOUND_TEST_SCHEMA: schema },
    });
    child.once('error', reject);
    child.once('exit', done);
  });
  assert.equal(code, 23);
  const abandoned = await reload(original);
  assert.equal(abandoned.status, 'claimed');
  assert.equal(abandoned.phase, 'ready');
  await expire(abandoned);
  await service.recoverExpiredInboundJobs();
  const saved = await reload(abandoned);
  const next = await service.claimNextInboundJob(saved.nextAttemptAt);
  assert.equal(next.replyCursor, 1);
  assert.equal(next.replies[1].content, 'pending');
});
test('confirmed completion after crash finishes without another attempt', async () => {
  await enqueue();
  const job = await service.claimNextInboundJob();
  await service.checkpointInboundJob(job, 'complete', { replies: [], replyCursor: 0 });
  await expire(job);
  await service.recoverExpiredInboundJobs();
  assert.equal((await reload(job)).status, 'done');
  assert.equal((await reload(job)).attempts, 1);
});
test('safe failures respect 5/10/20/40 second delays and stop after five claims', async () => {
  await enqueue();
  let job = await service.claimNextInboundJob();
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const start = Date.now();
    await service.markInboundJobFailed(job, 'safe failure before processing');
    const saved = await reload(job);
    if (attempt === 5) { assert.equal(saved.status, 'failed'); break; }
    assert.ok(saved.nextAttemptAt.getTime() >= start + 5000 * 2 ** (attempt - 1));
    assert.equal(await service.claimNextInboundJob(new Date(saved.nextAttemptAt.getTime() - 1)), null);
    job = await service.claimNextInboundJob(saved.nextAttemptAt);
    assert.equal(job.attempts, attempt + 1);
  }
  assert.equal(await service.claimNextInboundJob(new Date(Date.now() + 600_000)), null);
});
test('an engine exception with persisted processing phase cannot retry its effects', async () => {
  await enqueue();
  const job = await service.claimNextInboundJob();
  await service.checkpointInboundJob(job, 'processing');
  await service.markInboundJobFailed(job, 'exception after possible appointment creation');
  assert.equal((await reload(job)).status, 'needs_review');
  assert.equal(await service.claimNextInboundJob(), null);
});
