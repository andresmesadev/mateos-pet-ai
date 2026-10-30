// Entregable 8.2 (Fase 8), D-F1 — ver InboundJob en schema.prisma para el
// contexto completo. Este módulo es la única fuente de verdad para leer y
// escribir la cola; ni webhook.controller.js ni el worker tocan Prisma
// directamente sobre esta tabla.

const prisma = require("../lib/prisma");
const { randomUUID } = require('node:crypto');
const { digest } = require('../application/operator-channel/protocol');

const MAX_ATTEMPTS = 5;
const LEASE_MS = 120_000;
const HEARTBEAT_MS = 20_000;
const RETRY_BASE_MS = 5_000;
// Prisma espera solo 2 s por defecto para abrir una transacción interactiva.
// Los jobs programados comparten el pool, por lo que ese valor podía producir
// P2028 antes de ejecutar una sola consulta.
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 10_000 };

class InboundLeaseLostError extends Error {
  constructor(id) {
    super(`Inbound job lease lost: ${id}`);
    this.name = "InboundLeaseLostError";
  }
}

const ownedWhere = (job, now) => ({
  id: job.id, status: "claimed", attempts: job.attempts,
  leaseExpiresAt: { gt: now },
  ...(job.envelopeVersion === 2 ? { channelClaimGeneration: job.channelClaimGeneration, channelClaimOwner: job.channelClaimOwner } : {}),
});

const retryDelay = (attempts) => RETRY_BASE_MS * 2 ** Math.min(3, Math.max(0, attempts - 1));

// A persisted checkpoint determines whether repeating the next step is safe.
const recoveryData = (job, error, now) => {
  const base = { leaseExpiresAt: null, lastError: job.envelopeVersion === 2 ? 'OPERATOR_JOB_INTERRUPTED' : String(error?.message || error || "").slice(0, 2000),
    ...(job.envelopeVersion === 2 ? { channelClaimOwner: null } : {}) };
  if (job.phase === "complete") {
    return { ...base, status: "done", finishedAt: now, lastError: null };
  }
  if (error?.code === 'PROVIDER_ROUTE_CHANGED') {
    return { ...base, status: 'needs_review', finishedAt: now, lastError: 'PROVIDER_ROUTE_CHANGED' };
  }
  if (!["pending", "ready"].includes(job.phase)) {
    return { ...base, status: "needs_review", finishedAt: now,
      lastError: `UNCERTAIN_${job.phase}: ${base.lastError}`.slice(0, 2000) };
  }
  if (job.attempts >= MAX_ATTEMPTS) {
    return { ...base, status: "failed", finishedAt: now };
  }
  return { ...base, status: "received", claimedAt: null, finishedAt: null,
    nextAttemptAt: new Date(now.getTime() + retryDelay(job.attempts)) };
};

/**
 * Encolado idempotente: si ya existe un job para (provider, providerEventId)
 * — un reintento de webhook de Meta — no crea uno nuevo. `created: false`
 * le dice al llamador que no hay nada más que hacer.
 */
const enqueueInboundJob = async ({ provider, providerEventId, payload }) => {
  const prov = String(provider || "").trim();
  const eventId = String(providerEventId || "").trim();

  if (!prov || !eventId) {
    throw new Error("provider and providerEventId are required");
  }

  try {
    const existing = await prisma.inboundJob.findUnique({
      where: { provider_providerEventId: { provider: prov, providerEventId: eventId } },
    });

    if (existing) {
      return { job: existing, created: false };
    }

    const job = await prisma.inboundJob.create({
      data: { provider: prov, providerEventId: eventId, payload,
        ...(require('../lib/provider-execution').providerScope()?.whatsapp ? { providerRoute: require('../lib/provider-execution').routeSnapshot(require('../lib/provider-execution').providerScope().whatsapp) } : {}) },
    });

    return { job, created: true };
  } catch (error) {
    // Carrera real entre dos webhooks casi simultáneos con el mismo wamid:
    // el índice único gana, el segundo create falla con P2002. Se trata
    // igual que "ya existía" — nunca se pierde el evento, nunca se duplica.
    if (error.code === "P2002") {
      const existing = await prisma.inboundJob.findUnique({
        where: { provider_providerEventId: { provider: prov, providerEventId: eventId } },
      });
      return { job: existing, created: false };
    }
    console.error("[InboundJob] enqueue error:", error.message);
    throw error;
  }
};

// Admission and ordinal allocation commit together. The caller supplies only a
// sanitized envelope and an already verified route, never Meta's raw payload.
const enqueueOperatorJob = async ({ route, input }) => {
  try {
    return await prisma.$transaction(async tx => {
      const previous = await tx.inboundJob.findUnique({ where: { provider_providerEventId: { provider: 'whatsapp', providerEventId: input.id } } });
      if (previous) return { job: previous, created: false };
      const currentRoute = await tx.$queryRaw`SELECT id,version FROM "OperatorChannelRoute" WHERE id=${route.id} AND state='enabled' FOR SHARE`;
      if (!currentRoute.length || currentRoute[0].version !== route.version) throw new Error('OPERATOR_ROUTE_CHANGED');
      let participant = await tx.operatorParticipant.upsert({ where: { tenantId_routeId_phone: { tenantId: route.tenantId, routeId: route.id, phone: input.from } },
        create: { id: randomUUID(), tenantId: route.tenantId, routeId: route.id, phone: input.from, updatedAt: new Date() }, update: {} });
      await tx.$queryRaw`SELECT id FROM "OperatorParticipant" WHERE id=${participant.id} FOR UPDATE`;
      participant = await tx.operatorParticipant.findUnique({ where: { id: participant.id } });
      const rate = await tx.inboundJob.count({ where: { channelParticipantId: participant.id, createdAt: { gt: new Date(Date.now() - 60000) } } });
      if (rate >= 20) return { job: null, created: false };
      const barrier = ['negocio','clientes','link'].includes(input.kind);
      if (barrier && participant.currentSessionId) {
        await tx.operatorSession.updateMany({ where: { id: participant.currentSessionId, state: 'active' }, data: { state: 'closed', closedAt: new Date(), closeReason: 'mode_command' } });
        await tx.operatorInteraction.updateMany({ where: { sessionId: participant.currentSessionId, state: { in: ['prepared','offered'] } }, data: { state: 'invalidated' } });
      }
      participant = await tx.operatorParticipant.update({ where: { id: participant.id }, data: { admittedOrdinal: { increment: 1 }, updatedAt: new Date(),
        ...(barrier ? { mode: 'blocked', currentSessionId: null, blockedReason: 'mode_command_pending', modeVersion: { increment: 1 } } : {}) } });
      const envelope = { ...input, admissionModeVersion: String(participant.modeVersion) };
      const job = await tx.inboundJob.create({ data: { id: randomUUID(), provider: 'whatsapp', providerEventId: input.id, payload: envelope, envelopeVersion: 2,
        ...(require('../lib/provider-execution').providerScope()?.whatsapp ? { providerRoute: require('../lib/provider-execution').routeSnapshot(require('../lib/provider-execution').providerScope().whatsapp) } : {}),
        channelTenantId: route.tenantId, channelRouteId: route.id, channelParticipantId: participant.id, channelOrdinal: participant.admittedOrdinal,
        channelRouteVersion: route.version, channelInputHash: digest(envelope) } });
      return { job, created: true };
    }, TRANSACTION_OPTIONS);
  } catch (e) {
    if (e.code === 'P2002') { const job = await prisma.inboundJob.findUnique({ where: { provider_providerEventId: { provider: 'whatsapp', providerEventId: input.id } } }); if (job) return { job, created: false }; }
    throw Object.assign(new Error('OPERATOR_QUEUE_UNAVAILABLE'), { code: 'OPERATOR_QUEUE_UNAVAILABLE' });
  }
};

/**
 * Reclama un único job `received`, atómico vía `FOR UPDATE SKIP LOCKED` —
 * dos workers (o dos disparos de cron solapados) nunca reclaman la misma
 * fila. Retorna null si la cola está vacía.
 */
const claimNextInboundJob = (now = new Date()) =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT j.id,j."envelopeVersion" FROM "InboundJob" j
      WHERE status = 'received'
        AND "nextAttemptAt" <= ${now} AND attempts < ${MAX_ATTEMPTS}
        AND ("envelopeVersion"=1 OR EXISTS (SELECT 1 FROM "OperatorParticipant" p
          WHERE p.id=j."channelParticipantId" AND j."channelOrdinal"=p."resolvedOrdinal"+1))
      ORDER BY "createdAt" ASC, j.id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    const found = row;
    return tx.inboundJob.update({
      where: { id: row.id },
      data: { status: "claimed", claimedAt: now,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 },
        ...(found.envelopeVersion === 2 ? { channelClaimOwner: randomUUID(), channelClaimGeneration: { increment: 1 } } : {}) },
    });
  }, TRANSACTION_OPTIONS);

const updateOwned = async (job, data, now = new Date()) => {
  const result = await prisma.inboundJob.updateMany({ where: ownedWhere(job, now), data });
  if (result.count !== 1) throw new InboundLeaseLostError(job.id);
  return { ...job, ...data };
};

const checkpointInboundJob = (job, phase, data = {}) => updateOwned(job, { ...data, phase });

const renewInboundJobLease = (job) => updateOwned(job, { leaseExpiresAt: new Date(Date.now() + LEASE_MS) });

const resolveOperatorOrdinal = async (tx, job) => {
  if (job.envelopeVersion !== 2) return;
  await tx.operatorParticipant.updateMany({ where: { id: job.channelParticipantId, resolvedOrdinal: job.channelOrdinal - 1n }, data: { resolvedOrdinal: job.channelOrdinal, updatedAt: new Date() } });
};
const markInboundJobDone = async (job) => {
  if (job.phase !== "complete") throw new Error("Cannot finish an incomplete inbound job");
  if (job.envelopeVersion !== 2) return updateOwned(job, { status: "done", finishedAt: new Date(), lastError: null, leaseExpiresAt: null });
  return prisma.$transaction(async tx => {
    const changed = await tx.inboundJob.updateMany({ where: ownedWhere(job, new Date()), data: { status: 'done', finishedAt: new Date(), lastError: null, leaseExpiresAt: null, channelClaimOwner: null } });
    if (!changed.count) throw new InboundLeaseLostError(job.id);
    await resolveOperatorOrdinal(tx, job); return job;
  }, TRANSACTION_OPTIONS);
};

/**
 * Never infer safety from an exception: the engine/provider may already have
 * committed effects. Read the durable phase, not the worker's stale snapshot.
 * Only safe checkpoints retry, with a persisted delay respected by every tick.
 */
const markInboundJobFailed = async (claim, error) => {
  if (claim.envelopeVersion === 2) return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "InboundJob" WHERE id=${claim.id} FOR UPDATE`;
    const job = await tx.inboundJob.findUnique({ where: { id: claim.id } });
    if (!job || job.status !== 'claimed' || job.channelClaimOwner !== claim.channelClaimOwner || job.channelClaimGeneration !== claim.channelClaimGeneration || job.leaseExpiresAt <= new Date()) return null;
    const data = recoveryData(job, error, new Date());
    const result = await tx.inboundJob.update({ where: { id: job.id }, data });
    return result;
  }, TRANSACTION_OPTIONS);
  const job = await prisma.inboundJob.findUnique({ where: { id: claim.id } });
  if (!job || job.attempts !== claim.attempts || job.status !== "claimed") return null;
  const result = await updateOwned(job, recoveryData(job, error, new Date()));
  if (result.status === "needs_review") console.error(`[InboundJob] needs_review: ${job.id} (${job.phase})`);
  return result;
};

const recoverExpiredInboundJobs = (now = new Date()) => prisma.$transaction(async (tx) => {
  const jobs = await tx.$queryRaw`
    SELECT * FROM "InboundJob"
    WHERE status = 'claimed' AND ("leaseExpiresAt" <= ${now} OR "leaseExpiresAt" IS NULL)
    ORDER BY "createdAt" ASC, id ASC LIMIT 50 FOR UPDATE SKIP LOCKED
  `;
  for (const job of jobs) {
    const data = recoveryData(job, "LEASE_EXPIRED: worker interrupted", now);
    await tx.inboundJob.update({ where: { id: job.id }, data });
    if (data.status === "needs_review") console.error(`[InboundJob] needs_review: ${job.id} (${job.phase})`);
  }
  return jobs.length;
}, TRANSACTION_OPTIONS);

const getNextInboundAttemptAt = async () => {
  const rows = await prisma.$queryRaw`
    SELECT min(j."nextAttemptAt") AS "nextAttemptAt" FROM "InboundJob" j
    WHERE j.status='received' AND j.attempts<${MAX_ATTEMPTS}
      AND (j."envelopeVersion"=1 OR EXISTS (SELECT 1 FROM "OperatorParticipant" p
        WHERE p.id=j."channelParticipantId" AND j."channelOrdinal"=p."resolvedOrdinal"+1))
  `;
  return rows?.[0]?.nextAttemptAt ?? null;
};

module.exports = {
  enqueueOperatorJob,
  enqueueInboundJob,
  claimNextInboundJob,
  markInboundJobDone,
  markInboundJobFailed,
  checkpointInboundJob,
  renewInboundJobLease,
  recoverExpiredInboundJobs,
  getNextInboundAttemptAt,
  InboundLeaseLostError,
  HEARTBEAT_MS,
  LEASE_MS,
  MAX_ATTEMPTS,
  TRANSACTION_OPTIONS,
};
