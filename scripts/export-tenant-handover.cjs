// Run only after verifying the request through the established support procedure.
const path = require('node:path');
const { buildTenantHandover, writeHandover } = require('./tenant-handover.cjs');
async function main() {
  if (process.argv.length !== 7) throw new Error('HANDOVER_ARGUMENTS_REQUIRED');
  const args = Object.fromEntries(process.argv.slice(2).map(arg => {
    const match = /^--(tenant|case|operator|verified-channel|folder)=(.+)$/.exec(arg);
    if (!match) throw new Error('HANDOVER_ARGUMENTS_REQUIRED');
    return [match[1], match[2]];
  }));
  if (Object.keys(args).length !== 5 || !/^[A-Za-z0-9_-]{4,100}$/.test(args.folder || '') || !process.env.HUELLA_SUPPORT_EXPORT_DATABASE_URL) throw new Error('HANDOVER_ARGUMENTS_REQUIRED');
  // Explicit separate variable; never loads a .env or falls back to production.
  const { PrismaClient } = require('../node_modules/@prisma/client');
  const { PrismaPg } = require('../backend/node_modules/@prisma/adapter-pg');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.HUELLA_SUPPORT_EXPORT_DATABASE_URL }), log: [] });
  try {
    const packet = await buildTenantHandover(prisma, { tenantId: args.tenant, caseId: args.case, operator: args.operator, verifiedChannel: args['verified-channel'] });
    const result = writeHandover(packet, path.resolve(__dirname, '../.cache/tenant-handovers', args.folder));
    console.log(JSON.stringify({ directory: path.join('.cache/tenant-handovers', args.folder), verifiedFiles: result.files, rows: Object.values(result.counts).reduce((sum, n) => sum + n, 0) }));
  } finally { await prisma.$disconnect(); }
}
main().catch(error => {
  // Do not print driver messages, connection strings or source records.
  console.error(/^HANDOVER_[A-Z_]+$/.test(error.code || error.message) ? error.code || error.message : 'HANDOVER_FAILED_REVIEW_REQUIRED');
  process.exitCode = 1;
});
