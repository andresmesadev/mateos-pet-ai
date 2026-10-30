const prisma = require('../lib/prisma');
const { isWhatsAppEnabled } = require('../lib/whatsapp-runtime');
const routes = require('./whatsapp-route.service');
const quota = require('./ai-quota.service');
const { getInboundWorkerHealth } = require('./operational-health.service');
const { readOpenAIProbe } = require('./provider-health-observation');

function buildDashboardServiceStatus({ db = prisma, env = process.env, clock = Date.now,
  outbound = routes.outbound, aiStatus = quota.status, worker = getInboundWorkerHealth, probe = readOpenAIProbe } = {}) {
  return async function status(tenantId) {
    if (typeof tenantId !== 'string' || !tenantId) throw Object.assign(new Error('TENANT_REQUIRED'), { status: 403 });
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, active: true } });
    if (!tenant?.active) throw Object.assign(new Error('TENANT_NOT_ENABLED'), { status: 403 });
    const [whatsapp, ai] = await Promise.all([
      (async () => {
        try {
          if (!isWhatsAppEnabled(env)) return { state: 'paused' };
          if (!await outbound(tenantId)) return { state: 'unavailable' };
          return { state: worker().healthy ? 'configured' : 'worker_degraded' };
        } catch { return { state: 'unknown' }; }
      })(),
      (async () => {
        try {
          if (!env.OPENAI_API_KEY) return { state: 'not_configured' };
          const usage = await aiStatus(tenantId);
          if (usage.enabled && !usage.policyReady) return { state: 'policy_pending' };
          if (usage.enabled && !usage.configured) return { state: 'quota_pending' };
          if (usage.enabled && usage.exhausted) return { state: 'exhausted' };
          const observation = probe(clock());
          return { state: !observation ? 'unverified' : observation.ok ? 'observed_ok' : 'degraded',
            observedAt: observation?.observedAt ?? null };
        } catch { return { state: 'unknown' }; }
      })(),
    ]);
    return { tenantId: tenant.id, checkedAt: new Date(clock()).toISOString(), dashboard: { state: 'responding' }, whatsapp, ai };
  };
}
module.exports = { buildDashboardServiceStatus };
