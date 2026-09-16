// Entregable 8.2 (Fase 8), D-F1 — ver InboundJob en schema.prisma para el
// contexto completo. Este módulo es la única fuente de verdad para leer y
// escribir la cola; ni webhook.controller.js ni el worker tocan Prisma
// directamente sobre esta tabla.

const prisma = require("../lib/prisma");

const MAX_ATTEMPTS = 5;

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
const claimNextInboundJob = () =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id FROM "InboundJob"
      WHERE status = 'received'
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;

    return tx.inboundJob.update({
      where: { id: row.id },
      data: { status: "claimed", claimedAt: new Date(), attempts: { increment: 1 } },
    });
  });

const markInboundJobDone = (id) =>
  prisma.inboundJob.update({
    where: { id },
    data: { status: "done", finishedAt: new Date(), lastError: null },
  });

/**
 * Si ya alcanzó MAX_ATTEMPTS, queda `failed` (terminal, solo replay manual).
 * Si no, vuelve a `received` para que un próximo ciclo del worker lo reclame
 * — sin backoff (igual que el Build 1 de Sancho): el próximo ciclo de cron
 * ya introduce una espera natural.
 */
const markInboundJobFailed = async (id, error) => {
  const job = await prisma.inboundJob.findUnique({ where: { id } });
  if (!job) return null;

  const truncated = String(error?.message || error || "").slice(0, 2000);

  if (job.attempts >= MAX_ATTEMPTS) {
    return prisma.inboundJob.update({
      where: { id },
      data: { status: "failed", finishedAt: new Date(), lastError: truncated },
    });
  }

  return prisma.inboundJob.update({
    where: { id },
    data: { status: "received", claimedAt: null, lastError: truncated },
  });
};

module.exports = {
  enqueueInboundJob,
  claimNextInboundJob,
  markInboundJobDone,
  markInboundJobFailed,
  MAX_ATTEMPTS,
};
