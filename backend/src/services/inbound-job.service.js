// Entregable 8.2 (Fase 8), D-F1 — ver InboundJob en schema.prisma para el
// contexto completo. Este módulo es la única fuente de verdad para leer y
// escribir la cola; ni webhook.controller.js ni el worker tocan Prisma
// directamente sobre esta tabla.

const prisma = require("../lib/prisma");

const MAX_ATTEMPTS = 5;
const LEASE_MS = 120_000;
const HEARTBEAT_MS = 20_000;
const RETRY_BASE_MS = 5_000;

class InboundLeaseLostError extends Error {
  constructor(id) {
    super(`Inbound job lease lost: ${id}`);
    this.name = "InboundLeaseLostError";
  }
}

const ownedWhere = (job, now) => ({
  id: job.id, status: "claimed", attempts: job.attempts,
  leaseExpiresAt: { gt: now },
});

const retryDelay = (attempts) => RETRY_BASE_MS * 2 ** Math.min(3, Math.max(0, attempts - 1));

// A persisted checkpoint determines whether repeating the next step is safe.
const recoveryData = (job, error, now) => {
  const base = { leaseExpiresAt: null, lastError: String(error?.message || error || "").slice(0, 2000) };
  if (job.phase === "complete") {
    return { ...base, status: "done", finishedAt: now, lastError: null };
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
      data: { provider: prov, providerEventId: eventId, payload },
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

/**
 * Reclama un único job `received`, atómico vía `FOR UPDATE SKIP LOCKED` —
 * dos workers (o dos disparos de cron solapados) nunca reclaman la misma
 * fila. Retorna null si la cola está vacía.
 */
const claimNextInboundJob = (now = new Date()) =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id FROM "InboundJob"
      WHERE status = 'received'
        AND "nextAttemptAt" <= ${now} AND attempts < ${MAX_ATTEMPTS}
      ORDER BY "createdAt" ASC, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    return tx.inboundJob.update({
      where: { id: row.id },
      data: { status: "claimed", claimedAt: now,
        leaseExpiresAt: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
    });
  });

const updateOwned = async (job, data, now = new Date()) => {
  const result = await prisma.inboundJob.updateMany({ where: ownedWhere(job, now), data });
  if (result.count !== 1) throw new InboundLeaseLostError(job.id);
  return { ...job, ...data };
};

const checkpointInboundJob = (job, phase, data = {}) => updateOwned(job, { ...data, phase });

const renewInboundJobLease = (job) => updateOwned(job, { leaseExpiresAt: new Date(Date.now() + LEASE_MS) });

const markInboundJobDone = (job) => {
  if (job.phase !== "complete") throw new Error("Cannot finish an incomplete inbound job");
  return updateOwned(job, { status: "done", finishedAt: new Date(), lastError: null, leaseExpiresAt: null });
};

/**
 * Never infer safety from an exception: the engine/provider may already have
 * committed effects. Read the durable phase, not the worker's stale snapshot.
 * Only safe checkpoints retry, with a persisted delay respected by every tick.
 */
const markInboundJobFailed = async (claim, error) => {
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
});

const getNextInboundAttemptAt = async () => {
  const job = await prisma.inboundJob.findFirst({
    where: { status: "received", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    select: { nextAttemptAt: true },
  });
  return job?.nextAttemptAt ?? null;
};

module.exports = {
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
};
