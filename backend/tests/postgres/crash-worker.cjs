// Abrupt-exit fixture: no finally/disconnect, simulates loss of the worker after
// committing its checkpoint. Only the isolated test schema is permitted.
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const url = new URL(process.env.INBOUND_TEST_DATABASE_URL);
const schema = process.env.INBOUND_TEST_SCHEMA;
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/test/i.test(url.pathname) || !/^inbound_test_[a-f0-9]{32}$/.test(schema)) process.exit(2);
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({
  connectionString: url.toString(), options: `-c search_path=${schema}`,
}), { schema }) });
require.cache[require.resolve('../../src/lib/prisma')] = { exports: prisma };
const { claimNextInboundJob, checkpointInboundJob } = require('../../src/services/inbound-job.service');
(async () => {
  const job = await claimNextInboundJob();
  if (!job) process.exit(3);
  await checkpointInboundJob(job, 'ready', { replies: [{ content: 'confirmed' }, { content: 'pending' }], replyCursor: 1 });
  process.exit(23);
})().catch(() => process.exit(4));
