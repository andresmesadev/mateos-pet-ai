const { randomUUID } = require('node:crypto');
const { digest } = require('./protocol');
function buildOperatorMaintenance({ prisma, clock = () => new Date() }) {
  return async function maintain() {
    return prisma.$transaction(async tx => {
      const now = clock(); let expiredSessions = 0;
      const sessions = await tx.operatorSession.findMany({ where: { state: 'active', OR: [{ idleExpiresAt: { lte: now } }, { absoluteExpiresAt: { lte: now } }] }, orderBy: { participantId: 'asc' }, take: 50 });
      for (const s of sessions) {
        const participant = await tx.$queryRaw`SELECT id FROM "OperatorParticipant" WHERE id=${s.participantId} FOR UPDATE SKIP LOCKED`;
        if (!participant.length) continue;
        const changed = await tx.operatorSession.updateMany({ where: { id: s.id, state: 'active', OR: [{ idleExpiresAt: { lte: now } }, { absoluteExpiresAt: { lte: now } }] },
          data: { state: 'expired', closedAt: now, closeReason: 'session_expired' } });
        if (!changed.count) continue;
        await tx.operatorParticipant.updateMany({ where: { id: s.participantId, currentSessionId: s.id }, data: { mode: 'blocked', blockedReason: 'session_expired', currentSessionId: null, modeVersion: { increment: 1 }, updatedAt: now } });
        expiredSessions++;
      }
      const deliveries = await tx.$queryRaw`SELECT * FROM "OperatorDelivery" WHERE state='sending' AND "claimUntil"<=${now} ORDER BY id LIMIT 50 FOR UPDATE SKIP LOCKED`;
      for (const d of deliveries) {
        await tx.operatorDelivery.update({ where: { id: d.id }, data: { state: 'uncertain', claimOwner: null, claimUntil: null, lastErrorCode: 'INTERRUPTED_PROVIDER_ATTEMPT', updatedAt: now } });
        await tx.operatorAudit.create({ data: { id: randomUUID(), tenantId: d.tenantId, ownerPrincipalKey: d.principalKey, actorKind: 'service', eventCode: 'delivery_uncertain',
          causeKey: digest([d.id,d.attemptCount,'delivery_uncertain']), deliveryId: d.id, attemptNumber: d.attemptCount, evidence: { code: 'INTERRUPTED_PROVIDER_ATTEMPT' }, createdAt: now } });
      }
      async function batch(model, where, data) { const rows = await model.findMany({ where, select: { id: true }, orderBy: { id: 'asc' }, take: 50 }); if (rows.length) await model.updateMany({ where: { ...where, id: { in: rows.map(r=>r.id) } }, data }); }
      await batch(tx.operatorLinkChallenge, { state: { in: ['pending','proved'] }, expiresAt: { lte: now } }, { state: 'expired', finishedAt: now });
      await batch(tx.operatorLinkChallenge, { state: { notIn: ['pending','proved'] }, codeDigest: { not: null } }, { codeDigest: null, digestErasedAt: now });
      await batch(tx.operatorProof, { nonceDigest: { not: null }, OR: [{ consumedAt: { not: null } }, { expiresAt: { lte: now } }] }, { nonceDigest: null, digestErasedAt: now });
      await batch(tx.operatorInteraction, { state: { in: ['prepared','offered'] }, expiresAt: { lte: now } }, { state: 'invalidated' });
      return { expiredSessions, uncertainDeliveries: deliveries.length };
    }, { maxWait: 2000, timeout: 10000 });
  };
}
module.exports = { buildOperatorMaintenance };
