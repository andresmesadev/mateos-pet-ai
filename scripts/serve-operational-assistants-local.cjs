// Explicit disposable-DB UI fixture. Never reads production env files or starts jobs.
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { Pool } = require('../backend/node_modules/pg');
const { PrismaClient } = require('../node_modules/@prisma/client');
const { PrismaPg } = require('../backend/node_modules/@prisma/adapter-pg');
const { prismaPoolConfig } = require('../backend/src/lib/prisma-pool-config');
const connectionString = process.env.OPERATIONAL_TEST_DATABASE_URL;
assert(connectionString, 'Set OPERATIONAL_TEST_DATABASE_URL');
const url = new URL(connectionString);
assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname) && url.port === '55432' && /^\/operational_test[\w-]*$/.test(url.pathname), 'Disposable local DB on port 55432 only');
const root = path.resolve(__dirname, '..');
const privateMode = process.env.OPERATOR_UI_CHANNEL === '1';
Object.assign(process.env, { DATABASE_URL: connectionString, INTERNAL_API_SECRET: randomUUID(), NEXTAUTH_SECRET: randomUUID(),
  ADMIN_EMAIL: 'operational-ui@example.test', ADMIN_PASSWORD: 'LocalOperationalCheck-2026!', OPENAI_API_KEY: '', SENTRY_DSN: '', NODE_ENV: 'test' });
Object.assign(process.env, { OPERATOR_WHATSAPP_ENABLED: String(privateMode), OPERATOR_CHANNEL_HMAC_KEY: randomBytes(40).toString('hex'), OPERATOR_CHANNEL_KEY_VERSION: 'ui-v1',
  OPERATOR_AUTHORITY_URL: 'http://127.0.0.1:3337/api/internal/operator-authority', WHATSAPP_PHONE_NUMBER_ID: String(BigInt('800000000000') + BigInt(Math.floor(Math.random()*100000000000))), WHATSAPP_ACCESS_TOKEN: 'disposable-fixture-token' });
const pool = new Pool(prismaPoolConfig(connectionString)); const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
require.cache[require.resolve('../backend/src/lib/prisma')] = { exports: prisma };
let frontend, server, tenantId, dropConfirm = false;
async function main() {
  const marker = 'operational-ui-' + randomUUID();
  const tenant = await prisma.tenant.create({ data: { name: 'Equipo digital · prueba local', slug: marker, phone: privateMode ? process.env.WHATSAPP_PHONE_NUMBER_ID : marker, activeModules: ['retail','veterinary','grooming'] } }); tenantId = tenant.id;
  process.env.SINGLE_TENANT_ID = tenantId;
  const contexts = require('../backend/src/contexts'); const { inventory } = contexts;
  if (privateMode) {
    const { buildOperatorChannel } = require('../backend/src/application/operator-channel');
    const { buildOperationalContext } = require('../backend/src/contexts/agents/operational');
    const { PrismaUnitOfWork } = require('../backend/src/contexts/shared/persistence/prisma-unit-of-work');
    contexts.operatorChannel = buildOperatorChannel({ prisma, accessReader: inventory.accessReader, provider: async () => ({ state: 'accepted', messageId: 'fixture.'+randomUUID() }),
      buildOperational: operatorAccess => buildOperationalContext({ prisma, inventory, finance: require('../backend/src/contexts/finance'), events: contexts.events, unitOfWork: new PrismaUnitOfWork(), operatorAccess,
        interpret: async () => ({ intent: 'daily_close', fields: { date: '2026-10-15' } }) }) });
    contexts.operationalAssistants = contexts.operatorChannel.operational;
    await prisma.channel.create({ data: { tenantId, type: 'whatsapp' } });
  }
  const actor = { type: 'admin', email: process.env.ADMIN_EMAIL, name: 'Prueba local' };
  await inventory.commands.catalogue({ tenantId, actor, kind: 'create_product', operationKey: randomUUID(), command: { name: 'Guantes de prueba', internalCode: 'UI-TEST', category: 'Insumos', presentation: 'Caja', uses: ['retail','veterinary'], referenceCost: '10.00', salePrice: '15.00', stockMinimum: 2, lotPolicy: 'untracked' } });
  const express = require('../backend/node_modules/express'); const app = express(); app.use(express.json());
  app.use('/api/internal/operator-authority', require('../backend/src/middleware/requireInternalToken').requireInternalToken, require('../backend/src/routes/operator-authority.routes'));
  app.use((req, res, next) => {
    if (dropConfirm && req.method === 'POST' && /\/operational-assistants\/actions\/[^/]+\/confirm$/.test(req.path)) {
      const send = res.json.bind(res); res.json = body => {
        if (res.statusCode < 300 && body?.receipt) { dropConfirm = false; console.log('Dropped one confirmed response in the disposable fixture.'); res.socket?.destroy(); return res; }
        return send(body);
      };
    }
    next();
  });
  app.use('/api/dashboard', require('../backend/src/middleware/resolveTenant').resolveTenant, require('../backend/src/routes/dashboard.routes'));
  server = await new Promise(resolve => { const s = app.listen(3336, '127.0.0.1', () => resolve(s)); });
  frontend = spawn(process.execPath, [path.join(root,'frontend/node_modules/next/dist/bin/next'), 'start','-p','3337','-H','127.0.0.1'], {
    cwd: path.join(root,'frontend'), windowsHide: true, env: { ...process.env, NODE_ENV: 'production', API_URL: 'http://127.0.0.1:3336', NEXTAUTH_URL: 'http://localhost:3337', AUTH_URL: 'http://localhost:3337' }, stdio: ['ignore','pipe','pipe'],
  });
  frontend.stdout.on('data', bytes => { if (/Ready in/.test(String(bytes))) console.log(`UI ready: http://localhost:3337/dashboard/assistants?tenant=${tenantId}`); });
  frontend.stderr.on('data', bytes => console.log(String(bytes).slice(-1500)));
  console.log('Disposable login: operational-ui@example.test / LocalOperationalCheck-2026!');
  await new Promise(resolve => {
    process.stdin.setEncoding('utf8'); process.stdin.resume();
    process.stdin.on('data', async data => {
      if (privateMode && /^link [A-F0-9]{10}$/i.test(data.trim())) {
        try {
          const challenge = await prisma.operatorLinkChallenge.findFirst({ where: { tenantId, state: 'pending' }, orderBy: { createdAt: 'desc' } });
          assert(challenge, 'No pending fixture challenge');
          await contexts.operatorChannel.ingress({ entry: [{ changes: [{ value: { metadata: { phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID }, messages: [{ id: 'fixture.'+randomUUID(), from: challenge.phone,
            type: 'text', text: { body: '/vincular '+data.trim().slice(5) }, timestamp: String(Math.floor(Date.now()/1000)) }] } }] }] }, require('../backend/src/services/inbound-job.service').enqueueOperatorJob);
          const queue = require('../backend/src/services/inbound-job.service'); const job = await queue.claimNextInboundJob();
          const result = await contexts.operatorChannel.process(job);
          for (const reply of result.replies || []) await contexts.operatorChannel.delivery.send(reply.deliveryId);
          await queue.markInboundJobDone(await queue.checkpointInboundJob(result.job, 'complete'));
          console.log('Fixture phone proof processed; external sends: 0.');
        } catch (e) { console.log('Fixture phone proof failed: '+(e.code||e.name)); }
      }
      if (data.trim() === 'drop-confirm-response') { dropConfirm = true; console.log('Next successful confirm response will be dropped.'); }
      if (data.trim() === 'stop') resolve();
    });
    process.on('SIGINT', resolve); process.on('SIGTERM', resolve);
    frontend.on('exit', resolve);
  });
  console.log(JSON.stringify({ fixtureTenant: tenantId, expenses: await prisma.expense.count({ where: { tenantId } }), receipts: await prisma.executionReceipt.count({ where: { tenantId } }),
    entries: await prisma.inventoryOperation.count({ where: { tenantId, kind: 'register_entry' } }), employees: await prisma.digitalEmployee.count({ where: { tenantId } }) }));
}
main().catch(e => { console.error(e.code || e.message); process.exitCode = 1; }).finally(async () => {
  if (frontend && frontend.exitCode === null) frontend.kill(); if (server) await new Promise(r => server.close(r));
  await prisma.$disconnect(); await pool.end(); process.stdin.pause();
  console.log('Fixture servers stopped; disposable audit records retained until their container is removed.');
});
