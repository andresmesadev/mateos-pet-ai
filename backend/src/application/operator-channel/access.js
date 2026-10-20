const { fail, productContext } = require('../../contexts/agents/application/operational/policy');
const { digest } = require('./protocol');
const seal = Symbol('operator-channel-context');
const grants = new WeakMap();
const denied = () => fail('OPERATOR_ACCESS_EXPIRED', 'El acceso privado venció o cambió. Vuelve a /negocio o verifica tu acceso en el dashboard.', 403);
const adminGeneration = authority => digest({ authorityId: authority.id, credentialEpoch: String(authority.credentialEpoch), fingerprint: authority.credentialGeneration });
const projection = access => ({ role: access.role, activeModules: [...access.activeModules].sort(), capabilities: access.capabilities });
function buildOperatorAccess({ prisma, authority, accessReader, clock = () => new Date(), routeConfig }) {
  function attach(identity, grant) {
    const handle = Object.freeze({}); grants.set(handle, Object.freeze({ ...grant }));
    return { ...identity, [seal]: handle };
  }
  const grantFor = input => grants.get(input?.[seal]);
  async function acquire(input) {
    const g = grantFor(input); if (!g) return null;
    const subject = await prisma.operatorSubject.findUnique({ where: { id: g.subjectId } });
    if (!subject || subject.state !== 'active') denied();
    return subject.kind === 'admin' ? authority.live({ tenantId: input.tenantId, principalKey: subject.principalKey, sessionId: g.sessionId, purpose: g.purpose || 'access' }) : null;
  }
  async function check(input, ctx) {
    const g = grantFor(input); if (!g) return null;
    if (ctx.operatorAccess) return ctx.operatorAccess;
    const tx = ctx.tx;
    if (g.jobId) {
      const job = await tx.inboundJob.findUnique({ where: { id: g.jobId } });
      if (!job || job.status !== 'claimed' || job.channelClaimOwner !== g.claimOwner || job.channelClaimGeneration !== g.claimGeneration ||
          job.leaseExpiresAt <= clock() || job.channelSessionId !== g.sessionId || job.channelPrincipalKey !== g.principalKey) denied();
    }
    // Source locks precede derived identity/session locks, also for reads.
    await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${input.tenantId} FOR SHARE`;
    if (input.actor.staffId) {
      await tx.$queryRaw`SELECT id FROM "Staff" WHERE id=${input.actor.staffId} FOR SHARE`;
      await tx.$queryRaw`SELECT "staffId" FROM "StaffCredential" WHERE "staffId"=${input.actor.staffId} FOR SHARE`;
    }
    let issuer;
    if (!input.actor.staffId) issuer = await authority.consumeLive(tx, ctx.operatorProof, { tenantId: input.tenantId, principalKey: g.principalKey, purpose: g.purpose || 'access' });
    await tx.$queryRaw`SELECT id FROM "OperatorSubject" WHERE id=${g.subjectId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "OperatorChannelRoute" WHERE id=${g.routeId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "OperatorLink" WHERE id=${g.linkId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "OperatorParticipant" WHERE id=${g.participantId} FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM "OperatorSession" WHERE id=${g.sessionId} FOR SHARE`;
    const subject = await tx.operatorSubject.findUnique({ where: { id: g.subjectId } });
    const route = await tx.operatorChannelRoute.findUnique({ where: { id: g.routeId }, include: { channel: true } });
    const link = await tx.operatorLink.findUnique({ where: { id: g.linkId }, include: { currentAuthorization: true } });
    const participant = await tx.operatorParticipant.findUnique({ where: { id: g.participantId } });
    const session = await tx.operatorSession.findUnique({ where: { id: g.sessionId } });
    const tenant = await tx.tenant.findUnique({ where: { id: input.tenantId } });
    const now = clock();
    const matchingTenants = route ? await tx.tenant.count({ where: { active: true, phone: route.receiver } }) : 0;
    if (!subject || !route || !link || !participant || !session || !tenant?.active || matchingTenants !== 1 || subject.state !== 'active' || route.state !== 'enabled' || !route.channel.active ||
        link.state !== 'active' || session.state !== 'active' || participant.mode !== 'business' || participant.currentSessionId !== session.id ||
        subject.tenantId !== input.tenantId || subject.principalKey !== g.principalKey || link.subjectId !== subject.id || link.routeId !== route.id ||
        participant.routeId !== route.id || participant.phone !== link.phone || session.linkId !== link.id || session.participantId !== participant.id ||
        session.principalKey !== subject.principalKey || session.modeVersion !== participant.modeVersion || String(session.modeVersion) !== String(g.modeVersion) ||
        session.authorizationId !== link.currentAuthorizationId || session.routeVersion !== route.version || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now ||
        tenant.phone !== route.receiver || route.receiver !== routeConfig().receiver || route.configHash !== routeConfig().hash ||
        (route.channel.tenantId !== null && route.channel.tenantId !== tenant.id)) denied();
    const expectedEpoch = issuer ? issuer.credentialEpoch : subject.credentialEpoch;
    if (link.credentialEpoch !== expectedEpoch || session.credentialEpoch !== expectedEpoch ||
        (issuer && link.adminGeneration !== adminGeneration(issuer))) denied();
    const access = await accessReader.readAccess(input, ctx);
    if (access.principalKey !== subject.principalKey) denied();
    if (g.jobId) {
      await tx.$queryRaw`SELECT id FROM "InboundJob" WHERE id=${g.jobId} FOR SHARE`;
      const currentJob = await tx.inboundJob.findUnique({ where: { id: g.jobId } });
      if (currentJob.status !== 'claimed' || currentJob.channelClaimOwner !== g.claimOwner || currentJob.channelClaimGeneration !== g.claimGeneration || currentJob.leaseExpiresAt <= clock()) denied();
    }
    ctx.operatorAccess = { subject, route, link, participant, session, tenant, access };
    return ctx.operatorAccess;
  }
  async function identity(sessionId, purpose = 'access') {
    const session = await prisma.operatorSession.findUnique({ where: { id: sessionId }, include: { link: { include: { subject: true } } } });
    if (!session) denied();
    const subject = session.link.subject;
    let actor;
    if (subject.kind === 'staff') {
      const credential = await prisma.staffCredential.findUnique({ where: { staffId: subject.staffSourceId }, include: { staff: true } });
      if (!credential?.active || !credential.staff.active) denied();
      actor = { type: credential.staff.role, staffId: subject.staffSourceId, sessionVersion: credential.sessionVersion, name: credential.staff.name };
    } else actor = { type: 'admin', email: subject.principalKey.slice(6), name: 'Administrador' };
    return attach({ tenantId: session.tenantId, actor }, { subjectId: subject.id, principalKey: subject.principalKey, sessionId, linkId: session.linkId,
      routeId: session.link.routeId, participantId: session.participantId, modeVersion: session.modeVersion, purpose });
  }
  async function reviewBasis(input, row, ctx) {
    const basis = await ctx.tx.operatorReview.findFirst({ where: { actionId: row.id, revision: row.currentRevision, kind: 'basis' } });
    if (!basis) return;
    const subject = await ctx.tx.operatorSubject.findUnique({ where: { id: basis.subjectId } });
    const tenant = await ctx.tx.tenant.findUnique({ where: { id: row.tenantId } });
    if (!subject || subject.state !== 'active' || subject.principalKey !== row.principalKey || basis.permissionEpoch !== subject.permissionEpoch || basis.tenantAccessEpoch !== tenant?.operatorAccessEpoch)
      fail('REVIEW_ACCESS_CHANGED', 'Tus permisos cambiaron. Revisa la propuesta en una revisión nueva.', 409);
  }
  function withInteraction(input, interactionId, providerMessageId, tokenDigest) {
    const g = grantFor(input); if (!g) denied();
    return attach(input, { ...g, purpose: 'confirm', interactionId, providerMessageId, tokenDigest });
  }
  function forJob(input, job, workId) {
    const g = grantFor(input); if (!g) denied();
    return attach(input, { ...g, jobId: job.id, claimOwner: job.channelClaimOwner, claimGeneration: job.channelClaimGeneration, workId });
  }
  function withChoice(input, interactionId, providerMessageId, tokenDigest, purpose = 'revise') {
    const g = grantFor(input); if (!g) denied();
    return attach(input, { ...g, purpose, choiceId: interactionId, providerMessageId, tokenDigest });
  }
  async function choice(input, row, ctx) {
    const g = grantFor(input); if (!g?.choiceId) return;
    await ctx.tx.$queryRaw`SELECT id FROM "OperatorInteraction" WHERE id=${g.choiceId} FOR UPDATE`;
    const i = await ctx.tx.operatorInteraction.findUnique({ where: { id: g.choiceId } });
    const a = ctx.operatorAccess;
    if (!a || !i || !['select_product','continue'].includes(i.kind) || i.state !== 'offered' || i.expiresAt <= clock() || i.sessionId !== a.session.id ||
        i.tokenDigest !== g.tokenDigest || i.keyVersion !== authority.settings.keyVersion || i.providerMessageId !== g.providerMessageId || i.modeVersion !== a.participant.modeVersion || i.routeVersion !== a.route.version ||
        i.permissionEpoch !== a.subject.permissionEpoch || i.tenantAccessEpoch !== a.tenant.operatorAccessEpoch) denied();
    if (i.kind === 'select_product') {
      if (!row || i.actionId !== row.id || i.expectedRevision !== row.currentRevision) denied();
      await ctx.tx.$queryRaw`SELECT id FROM "InventoryProduct" WHERE id=${i.productId} AND "tenantId"=${row.tenantId} FOR SHARE`;
      const current = await ctx.tx.inventoryProduct.findUnique({ where: { id: i.productId } });
      if (!current?.active || current.removedAt || digest(productContext(current)) !== digest(i.selectionContext.productContext)) fail('PRODUCT_CHANGED', 'El producto cambió. Búscalo y selecciónalo otra vez.', 409);
    }
    ctx.operatorChoice = i;
  }
  async function completeWork(input, result, ctx) {
    const g = grantFor(input); if (!g?.workId) return;
    const work = await ctx.tx.operatorInboundWork.findUnique({ where: { id: g.workId } });
    if (!work || work.jobId !== g.jobId || work.sessionId !== g.sessionId || work.principalKey !== g.principalKey || work.state !== 'reserved') denied();
    if (g.choiceId && !ctx.operatorChoice) await choice(input, null, ctx);
    if (result.operationalRequestId) {
      const request = await ctx.tx.operationalRequest.findUnique({ where: { id: result.operationalRequestId } });
      if (work.kind !== 'request' || request?.requestId !== work.requestKey || request.principalKey !== g.principalKey) denied();
    }
    await ctx.tx.operatorInboundWork.update({ where: { id: work.id }, data: { state: 'resolved', resolvedAt: clock(), result, ...(result.operationalRequestId ? { operationalRequestId: result.operationalRequestId } : {}) } });
    if (result.taskId && ctx.operatorAccess) await ctx.tx.operatorThread.update({ where: { id: ctx.operatorAccess.session.threadId }, data: { taskContext: { taskId: result.taskId }, version: { increment: 1 } } });
    if (ctx.operatorChoice) await ctx.tx.operatorInteraction.update({ where: { id: ctx.operatorChoice.id }, data: { state: 'consumed', consumedAt: clock(), resultReference: result } });
  }
  async function confirmation(input, row, ctx) {
    await reviewBasis(input, row, ctx);
    const g = grantFor(input); if (!g) return;
    if (!g.interactionId) fail('NATIVE_CONFIRMATION_REQUIRED', 'Usa el botón de la vista previa o confirma desde el dashboard.', 403);
    await ctx.tx.$queryRaw`SELECT id FROM "OperatorInteraction" WHERE id=${g.interactionId} FOR UPDATE`;
    const i = await ctx.tx.operatorInteraction.findUnique({ where: { id: g.interactionId }, include: { review: true } });
    const a = ctx.operatorAccess;
    if (!i || !a || i.tenantId !== row.tenantId || i.principalKey !== row.principalKey || i.sessionId !== a.session.id || i.kind !== 'confirm' ||
        i.actionId !== row.id || i.expectedRevision !== row.currentRevision || i.tokenDigest !== g.tokenDigest || i.keyVersion !== authority.settings.keyVersion || i.providerMessageId !== g.providerMessageId ||
        i.modeVersion !== a.participant.modeVersion || i.routeVersion !== a.route.version || i.permissionEpoch !== a.subject.permissionEpoch ||
        i.tenantAccessEpoch !== a.tenant.operatorAccessEpoch || i.review?.payloadHash !== row.current.payloadHash ||
        !['offered','consumed'].includes(i.state) || (i.state === 'offered' && i.expiresAt <= clock()))
      fail('INVALID_CONFIRMATION', 'El botón venció o no corresponde a esta propuesta. Recupera una vista previa nueva.', 409);
    if (i.state === 'consumed' && i.receiptId !== row.receipts[0]?.id) denied();
    ctx.operatorInteraction = i;
  }
  async function recordReceipt(input, receipt, ctx) {
    const g = grantFor(input); if (!g) return;
    if (g.jobId && (await ctx.tx.inboundJob.findUnique({ where: { id: g.jobId } })).leaseExpiresAt <= clock()) denied();
    const i = ctx.operatorInteraction; if (!i || i.state !== 'offered') denied();
    await ctx.tx.operatorInteraction.update({ where: { id: i.id }, data: { state: 'consumed', consumedAt: clock(), receiptId: receipt.id, resultReference: { receiptId: receipt.id } } });
  }
  return { attach, grantFor, acquire, check, identity, reviewBasis, confirmation, recordReceipt, withInteraction, forJob, withChoice, choice, completeWork, adminGeneration };
}
module.exports = { buildOperatorAccess, adminGeneration, projection };
