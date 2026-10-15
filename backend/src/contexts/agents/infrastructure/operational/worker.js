const { randomUUID } = require('node:crypto');
const { hash } = require('../../application/operational/policy');
function buildOperationalWorker({ prisma, store, events }) {
  const now = store.clock;
  async function expire() {
    const candidates = await prisma.operationalAction.findMany({ where: { state: 'lista', current: { expiresAt: { lte: now() } } }, take: 25, orderBy: { id: 'asc' } });
    let closed = 0;
    for (const candidate of candidates) await store.run(async ctx => {
      const request = await ctx.tx.$queryRaw`SELECT id FROM "OperationalRequest" WHERE id=${candidate.requestId} FOR UPDATE SKIP LOCKED`;
      if (!request.length) return;
      const selected = await ctx.tx.$queryRaw`SELECT id FROM "OperationalAction" WHERE id=${candidate.id} FOR UPDATE SKIP LOCKED`;
      if (!selected.length) return;
      const row = await store.action({ tenantId: candidate.tenantId, principalKey: candidate.principalKey }, candidate.id, ctx);
      if (row.state !== 'lista' || row.current.expiresAt > now()) return;
      ctx.eventPublisher = store.collector();
      await store.audit.registerAgentDecision({ agentTaskId: row.taskId, action: 'vencer_propuesta', input: { actionId: row.id, revision: row.currentRevision }, reasoning: 'La propuesta lista superó su vigencia sin confirmación.' }, ctx);
      await store.audit.completeAgentTask({ agentTaskId: row.taskId, result: { v: 1, operationalRequestId: row.requestId, actionId: row.id, outcome: 'vencida', effect: 'ninguno' } }, ctx);
      await store.closeAction(row.id, 'vencida', 'proposal_expired', ctx);
      await store.flush(row.request, ctx.eventPublisher, `action:${row.id}:terminal`, ctx); closed++;
    });
    return closed;
  }
  async function certify(candidate) {
    const claim = await store.run(async ctx => {
      const owner = randomUUID(); const time = now();
      const changed = await ctx.tx.publicationIntent.updateMany({ where: { id: candidate.id, certificationState: 'pendiente', claimGeneration: candidate.claimGeneration,
        nextAttemptAt: { lte: time }, OR: [{ claimOwner: null }, { claimUntil: { lte: time } }] },
      data: { claimOwner: owner, claimGeneration: { increment: 1 }, certificationTries: { increment: 1 }, claimUntil: new Date(time.getTime() + 60000), updatedAt: time } });
      return changed.count ? ctx.tx.publicationIntent.findUnique({ where: { id: candidate.id } }) : null;
    });
    if (!claim) return false;
    try {
      return await store.run(async ctx => {
        await ctx.tx.$queryRaw`SELECT id FROM "PublicationIntent" WHERE id=${claim.id} FOR UPDATE`;
        const p = await ctx.tx.publicationIntent.findUnique({ where: { id: claim.id } });
        if (p.claimOwner !== claim.claimOwner || p.claimGeneration !== claim.claimGeneration || p.claimUntil <= now() || p.certificationState !== 'pendiente') return false;
        const envelope = { tenantId: p.tenantId, eventTypeName: p.eventName, origin: p.origin, occurredAt: p.occurredAt.toISOString(), payload: p.payload };
        if (hash(envelope) !== p.envelopeHash) throw Object.assign(new Error('Invalid envelope'), { code: 'ENVELOPE_CHANGED' });
        await events.registerDomainEvent({ ...envelope, occurredAt: p.occurredAt, id: p.id, dispatch: 'deferred' }, ctx);
        const linked = await ctx.tx.publicationIntent.updateMany({ where: { id: p.id, claimOwner: claim.claimOwner, claimGeneration: claim.claimGeneration, claimUntil: { gt: now() }, certificationState: 'pendiente' },
          data: { certificationState: 'certificada', domainEventId: p.id, certifiedAt: now(), claimOwner: null, claimUntil: null, certificationError: null, updatedAt: now() } });
        if (!linked.count) throw Object.assign(new Error('Certification lease lost'), { code: 'CLAIM_LOST' });
        return true;
      });
    } catch (e) {
      const permanent = e.code === 'ENVELOPE_CHANGED' || /EventType(NotFound|NotActive)|InvalidDomainEvent/.test(e.name);
      const minutes = claim.certificationTries === 1n ? 1 : claim.certificationTries === 2n ? 5 : 15;
      await prisma.publicationIntent.updateMany({ where: { id: claim.id, claimOwner: claim.claimOwner, claimGeneration: claim.claimGeneration, claimUntil: { gt: now() }, certificationState: 'pendiente' },
        data: { certificationState: permanent ? 'requiere_revision' : 'pendiente', claimOwner: null, claimUntil: null, certificationError: e.code || e.name,
          nextAttemptAt: new Date(now().getTime() + minutes * 60000), updatedAt: now() } });
      return false;
    }
  }
  async function notify(id) {
    const notificationId = randomUUID();
    const claimed = await prisma.publicationIntent.updateMany({ where: { id, certificationState: 'certificada', notificationState: 'no_iniciada' },
      data: { notificationState: 'iniciada', notificationId, notificationStarted: now(), updatedAt: now() } });
    if (!claimed.count) return false;
    let code = 'EVIDENCE_REQUIRED'; let evidence = {}; let verified = false;
    try {
      await events.notifyCertifiedEvent({ id });
      const [deliveries, executions] = await Promise.all([
        prisma.eventDelivery.findMany({ where: { domainEventId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 }),
        prisma.automationExecution.findMany({ where: { domainEventId: id }, take: 100 }),
      ]);
      const delivery = deliveries.find(d => d.consumer === 'Automatizaciones');
      verified = delivery?.status === 'delivered' && executions.every(e => e.status === 'success') && executions.length < 100 && deliveries.length < 100;
      code = verified ? (executions.length ? 'VERIFIED' : 'EVALUATED_NO_EXECUTIONS') : 'DELIVERY_REVIEW_REQUIRED';
      evidence = { deliveryIds: deliveries.map(d => d.id), executionIds: executions.map(e => e.id), verified };
    } catch (e) { code = e.code || e.name || 'DELIVERY_UNCERTAIN'; }
    const finished = await prisma.publicationIntent.updateMany({ where: { id, notificationId, notificationState: 'iniciada' },
      data: { notificationState: verified ? 'verificada' : 'requiere_revision', notificationEnded: now(), notificationCode: code, notificationEvidence: evidence, updatedAt: now() } });
    if (!finished.count) await prisma.publicationIntent.updateMany({ where: { id, notificationId, notificationState: 'requiere_revision' }, data: { notificationEvidence: { ...evidence, lateCode: code }, updatedAt: now() } });
    return verified;
  }
  async function tick() {
    const expired = await expire();
    const pending = await prisma.publicationIntent.findMany({ where: { certificationState: 'pendiente', nextAttemptAt: { lte: now() }, OR: [{ claimOwner: null }, { claimUntil: { lte: now() } }] }, orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }], take: 25 });
    for (const row of pending) await certify(row);
    await prisma.publicationIntent.updateMany({ where: { notificationState: 'iniciada', notificationStarted: { lte: new Date(now().getTime() - 300000) } }, data: { notificationState: 'requiere_revision', notificationEnded: now(), notificationCode: 'PROCESS_RESULT_UNCERTAIN', updatedAt: now() } });
    const ready = await prisma.publicationIntent.findMany({ where: { certificationState: 'certificada', notificationState: 'no_iniciada' }, orderBy: [{ certifiedAt: 'asc' }, { id: 'asc' }], take: 25 });
    for (const row of ready) await notify(row.id);
    return { expired, certificationCandidates: pending.length, notificationCandidates: ready.length };
  }
  return { tick, expire, certify, notify };
}
module.exports = { buildOperationalWorker };
