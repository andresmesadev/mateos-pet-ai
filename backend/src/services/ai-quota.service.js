const { randomUUID, createHash } = require('node:crypto');
const prisma = require('../lib/prisma');
const { providerScope } = require('../lib/provider-execution');
const { meterOperation, transcriptionDurationConfirmed, METER_REVISION, TEXT_BLOCK_BYTES, MAX_AUDIO_SECONDS, MAX_COMPLETION_TOKENS } = require('./ai-metering.service');
const OPERATIONS = ['analyze', 'reply', 'embedding', 'transcription', 'interpret'];
const enabled = (env = process.env) => String(env.AI_QUOTA_ENABLED || '').toLowerCase() === 'true';
// SDK calls time out within 30 seconds without hidden retries. A crashed call
// remains reserved; after this grace it is visible for evidence-based review.
const REVIEW_GRACE_MS = 15 * 60 * 1000;
const problem = (code, status = 409) => Object.assign(new Error(code), { code, status });
function monthKey(date) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return parts.find(p => p.type === 'year').value + '-' + parts.find(p => p.type === 'month').value;
}
function policy(env = process.env) {
  try {
    const units = JSON.parse(env.AI_OPERATION_UNITS_JSON || 'null'), version = env.AI_QUOTA_POLICY_VERSION;
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(version || '') || !units || !OPERATIONS.every(k => Number.isSafeInteger(units[k]) && units[k] > 0 && units[k] <= 1000000) || Object.keys(units).some(k => !OPERATIONS.includes(k))) throw Error('configuration');
    // Fingerprint the weights as well as the algorithm: neither may reprice an open month.
    const fingerprint = createHash('sha256').update(JSON.stringify(OPERATIONS.map(k => units[k]))).digest('hex').slice(0,12);
    return { units, version: `${version}.${METER_REVISION}.${fingerprint}` };
  } catch { throw problem('AI_QUOTA_POLICY_NOT_CONFIGURED', 503); }
}
function usageMetadata(response) {
  const usage = response?.usage || {};
  return { ...(typeof response?.model === 'string' ? { model: response.model.slice(0,80) } : {}),
    ...Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens','input_tokens','output_tokens'].filter(k => Number.isSafeInteger(usage[k]) && usage[k] >= 0).map(k => [k, usage[k]])),
    ...(Number.isFinite(response?.duration) && response.duration >= 0 ? { durationSeconds: response.duration } : {}),
    ...(typeof response?._request_id === 'string' ? { requestId: response._request_id.slice(0,128) } : {}) };
}

function buildAiQuota({ db = prisma, env = process.env, clock = () => new Date() } = {}) {
  const txRun = fn => db.$transaction(fn, { maxWait: 3000, timeout: 10000 });
  async function lockTenant(tx, tenantId, requireActive = false) {
    if (typeof tenantId !== 'string' || !tenantId) throw problem('AI_TENANT_REQUIRED', 403);
    await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${tenantId} FOR UPDATE`;
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { active: true } });
    if (!tenant || (requireActive && !tenant.active)) throw problem('AI_TENANT_NOT_ENABLED', 403);
  }
  async function status(tenantId) {
    const month = monthKey(clock());
    const [config, period, pending] = await Promise.all([
      db.aiQuotaConfig.findUnique({ where: { tenantId } }),
      db.aiQuotaPeriod.findUnique({ where: { tenantId_monthKey: { tenantId, monthKey: month } } }),
      db.aiUsageEntry.findMany({ where: { tenantId, OR: [{ state: 'uncertain' },{ state: 'reserved', createdAt: { lte: new Date(+clock()-REVIEW_GRACE_MS) } }] }, select: { id: true, operation: true, units: true, state: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    const limit = period?.quotaLimit ?? config?.monthlyLimit ?? 0, used = period?.usedUnits ?? 0, reserved = period?.reservedUnits ?? 0;
    let currentPolicy = null; try { currentPolicy = policy(env); } catch { /* unavailable until configured */ }
    const policyReady = Boolean(currentPolicy && (!period || period.policyVersion === currentPolicy.version));
    return { month, timeZone: 'America/Bogota', enabled: enabled(env), configured: Boolean(config), policyReady, policyVersion: period?.policyVersion ?? currentPolicy?.version ?? null,
      metering: { textBlockBytes: TEXT_BLOCK_BYTES, maxAudioSeconds: MAX_AUDIO_SECONDS, maxCompletionTokens: MAX_COMPLETION_TOKENS, transcriptionUnitsPerMinute: currentPolicy?.units.transcription ?? null },
      limit, used, reserved, remaining: Math.max(0,limit-used-reserved), exhausted: limit-used-reserved <= 0, pending };
  }
  async function setLimit({ tenantId, monthlyLimit, actorKey }) {
    if (!Number.isSafeInteger(monthlyLimit) || monthlyLimit < 0 || monthlyLimit > 1000000000 || typeof actorKey !== 'string' || !actorKey) throw problem('INVALID_AI_QUOTA', 400);
    return txRun(async tx => {
      await lockTenant(tx, tenantId);
      const month = monthKey(clock());
      const current = await tx.aiQuotaConfig.findUnique({ where: { tenantId } });
      const period = await tx.aiQuotaPeriod.findUnique({ where: { tenantId_monthKey: { tenantId, monthKey: month } } });
      if (period && period.usedUnits + period.reservedUnits > monthlyLimit) throw problem('AI_QUOTA_BELOW_COMMITTED_USAGE');
      await tx.aiQuotaConfig.upsert({ where: { tenantId }, create: { tenantId, monthlyLimit }, update: { monthlyLimit } });
      if (period) await tx.aiQuotaPeriod.update({ where: { id: period.id }, data: { quotaLimit: monthlyLimit } });
      await tx.aiQuotaChange.create({ data: { id: randomUUID(), tenantId, actorHash: createHash('sha256').update(actorKey).digest('hex'), previousLimit: current?.monthlyLimit ?? 0, newLimit: monthlyLimit } });
      return { saved: true, monthlyLimit };
    });
  }
  async function reserve({ tenantId, operation, operationKey = randomUUID(), inputBytes = 0, durationSeconds }) {
    const config = policy(env);
    if (!OPERATIONS.includes(operation) || typeof operationKey !== 'string' || !/^[A-Za-z0-9:._-]{1,128}$/.test(operationKey)) throw problem('INVALID_AI_OPERATION', 400);
    const { units, meter } = meterOperation(operation, { inputBytes, durationSeconds }, config.units[operation]);
    return txRun(async tx => {
      await lockTenant(tx, tenantId, true);
      if (await tx.aiUsageEntry.findUnique({ where: { tenantId_operationKey: { tenantId, operationKey } } })) throw problem('AI_OPERATION_ALREADY_RESERVED');
      const quota = await tx.aiQuotaConfig.findUnique({ where: { tenantId } });
      if (!quota) throw problem('AI_QUOTA_NOT_ASSIGNED', 402);
      const month = monthKey(clock());
      const period = await tx.aiQuotaPeriod.upsert({ where: { tenantId_monthKey: { tenantId, monthKey: month } }, update: {},
        create: { id: randomUUID(), tenantId, monthKey: month, quotaLimit: quota.monthlyLimit, policyVersion: config.version } });
      if (period.policyVersion !== config.version) throw problem('AI_QUOTA_POLICY_CHANGED', 503);
      if (period.usedUnits + period.reservedUnits + units > period.quotaLimit) throw problem('AI_QUOTA_EXHAUSTED', 402);
      const entry = await tx.aiUsageEntry.create({ data: { id: randomUUID(), tenantId, periodId: period.id, operationKey, operation, units, state: 'reserved', providerUsage: { meter } } });
      await tx.aiQuotaPeriod.update({ where: { id: period.id }, data: { reservedUnits: { increment: units } } });
      return entry;
    });
  }
  async function settle({ tenantId, entryId, state, providerUsage = {}, reconciliation = null }) {
    if (!['accepted','rejected','uncertain'].includes(state)) throw problem('INVALID_AI_SETTLEMENT', 400);
    return txRun(async tx => {
      await lockTenant(tx, tenantId);
      const entry = await tx.aiUsageEntry.findFirst({ where: { id: entryId, tenantId } });
      if (!entry) throw problem('AI_USAGE_NOT_FOUND', 404);
      if (entry.state !== 'reserved' && !(entry.state === 'uncertain' && reconciliation && state !== 'uncertain')) {
        if (entry.state !== state) throw problem('AI_SETTLEMENT_CONFLICT');
        return entry;
      }
      if (state !== 'uncertain') await tx.aiQuotaPeriod.update({ where: { id: entry.periodId }, data: {
        reservedUnits: { decrement: entry.units }, ...(state === 'accepted' ? { usedUnits: { increment: entry.units } } : {}) } });
      return tx.aiUsageEntry.update({ where: { id: entry.id }, data: { state, settledAt: state === 'uncertain' ? null : clock(),
        providerUsage: { ...(entry.providerUsage || {}), ...providerUsage, ...(reconciliation ? { reconciliation } : {}) } } });
    });
  }
  async function reconcile({ tenantId, entryId, accepted, receiptRef, actorKey }) {
    if (typeof accepted !== 'boolean' || typeof receiptRef !== 'string' || !receiptRef.trim() || receiptRef.length > 256 || typeof actorKey !== 'string' || !actorKey) throw problem('AI_RECONCILIATION_EVIDENCE_REQUIRED', 400);
    const current = await db.aiUsageEntry.findFirst({ where: { id: entryId, tenantId } });
    if (!current || !(current.state === 'uncertain' || (current.state === 'reserved' && +current.createdAt <= +clock()-REVIEW_GRACE_MS))) throw problem('AI_USAGE_NOT_PENDING', 409);
    return settle({ tenantId, entryId, state: accepted ? 'accepted' : 'rejected', reconciliation: {
      receiptRef: receiptRef.trim(), actorHash: createHash('sha256').update(actorKey).digest('hex'), at: clock().toISOString(), previousState: current.state } });
  }
  async function execute({ tenantId, operation, operationKey, inputBytes, durationSeconds }, call) {
    if (!enabled(env)) return call();
    const reservation = await reserve({ tenantId, operation, operationKey, inputBytes, durationSeconds });
    let response;
    try { response = await call({ maxRetries: 0 }); }
    catch (error) {
      const rejection = [400,401,403,404,405,413,422,429].includes(error.status);
      await settle({ tenantId, entryId: reservation.id, state: rejection ? 'rejected' : 'uncertain', providerUsage: { failureKind: rejection ? 'provider_rejected' : 'acceptance_unknown' } });
      throw error;
    }
    if (operation === 'transcription' && !transcriptionDurationConfirmed(response, durationSeconds)) {
      await settle({ tenantId, entryId: reservation.id, state: 'uncertain', providerUsage: {
        ...usageMetadata(response), failureKind: 'audio_duration_unconfirmed' } });
      throw problem('AI_AUDIO_DURATION_UNCONFIRMED', 503);
    }
    await settle({ tenantId, entryId: reservation.id, state: 'accepted', providerUsage: usageMetadata(response) });
    return response;
  }
  return { status, setLimit, reserve, settle, reconcile, execute };
}
const service = Object.fromEntries(['status','setLimit','reserve','settle','reconcile','execute'].map(name => [name, (...args) => buildAiQuota()[name](...args)]));
function executeTenantAi(operation, input, call, measurement = {}) {
  const scope = providerScope();
  const serializedBytes = typeof input === 'number' ? input : Buffer.byteLength(typeof input === 'string' ? input : JSON.stringify(input ?? ''));
  const inputBytes = serializedBytes + (['analyze','reply','interpret'].includes(operation) ? 256 : 0);
  return service.execute({ tenantId: scope?.tenantId, operation, inputBytes, durationSeconds: measurement.durationSeconds }, call);
}
module.exports = { buildAiQuota, executeTenantAi, isAiQuotaEnabled: enabled, aiQuotaPolicy: policy, monthKey, usageMetadata, ...service };
