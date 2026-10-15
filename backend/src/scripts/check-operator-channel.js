const p = require('../application/operator-channel/protocol');
const { buildOperatorAuthority } = require('../application/operator-channel/authority');

// No Meta calls and no writes from this checker. Only report readiness after
// storage and the private, signed backend -> Next round trip both succeed.
async function checkOperatorChannel({ prisma, env = process.env, fetcher, clock = () => new Date() } = {}) {
  const settings = p.config(env);
  if (!settings.enabled) return { status: 'disabled' };
  const row = await prisma.operatorAuthority.findUnique({ where: { issuer: 'dashboard-admin' } });
  const tenant = await prisma.tenant.findFirst({ where: { active: true }, select: { id: true } });
  if (!row || row.state !== 'active' || !tenant) throw Error('OPERATOR_AUTHORITY_NOT_READY');
  const authority = buildOperatorAuthority({ prisma, settings, issuerUrl: env.OPERATOR_AUTHORITY_URL, fetcher, clock });
  const envelope = await authority.live({ tenantId: tenant.id, principalKey: row.principalKey, sessionId: null, purpose: 'access' });
  const claim = p.verify(settings.key, settings.keyVersion, envelope, 'access', 30000, clock());
  const current = await prisma.operatorAuthority.findUnique({ where: { issuer: 'dashboard-admin' } });
  const b = claim.body;
  if (!current || current.state !== 'active' || b.authorityId !== current.id || b.bootId !== current.bootId || b.epoch !== String(current.epoch) ||
      b.credentialEpoch !== String(current.credentialEpoch) || b.credentialGeneration !== current.credentialGeneration || b.principalKey !== current.principalKey) {
    throw Error('OPERATOR_AUTHORITY_NOT_READY');
  }
  return { status: 'ready', checks: { storage: true, authorityRpc: true }, metaTransport: 'not_tested' };
}

if (require.main === module) {
  require('dotenv').config({ quiet: true });
  let prisma;
  (async () => {
    if (process.env.OPERATOR_WHATSAPP_ENABLED === 'true') prisma = require('../lib/prisma');
    console.log(JSON.stringify(await checkOperatorChannel({ prisma })));
  })().catch(() => {
    console.error(JSON.stringify({ status: 'unavailable', code: 'OPERATOR_CHANNEL_PREFLIGHT_FAILED' }));
    process.exitCode = 1;
  }).finally(async () => { if (prisma) await prisma.$disconnect(); });
}
module.exports = { checkOperatorChannel };
