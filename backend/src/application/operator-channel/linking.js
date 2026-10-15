const { randomUUID, randomBytes } = require('node:crypto');
const p = require('./protocol');
const { fail, json } = require('../../contexts/agents/application/operational/policy');
const { adminGeneration } = require('./access');
const bad = (code = 'OPERATOR_ACCESS_DENIED', message = 'Verifica tu acceso desde el dashboard.', status = 403) => fail(code, message, status);
const scopeOf = input => ({ tenantId: input.tenantId, principalKey: input.actor?.staffId ? `staff:${input.actor.staffId}` : p.principal(input.actor?.email || '') });
function buildOperatorLinking({ prisma, authority, accessReader, routeConfig, clock = () => new Date() }) {
  const ready = () => { if (!authority.settings.enabled) bad('OPERATOR_CHANNEL_DISABLED', 'El canal privado de WhatsApp todavía no está habilitado.', 503); };
  async function run(fn) {
    return prisma.$transaction(async tx => { await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'"); return fn(tx); }, { isolationLevel: 'ReadCommitted', maxWait: 2000, timeout: 10000 });
  }
  async function source(input, tx) {
    if (!input.tenantId || input.viewAllTenants || !input.actor || (!input.actor.staffId && (!input.actor.email || input.actor.type !== 'admin'))) bad();
    await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${input.tenantId} FOR SHARE`;
    if (input.actor.staffId) {
      await tx.$queryRaw`SELECT id FROM "Staff" WHERE id=${input.actor.staffId} FOR SHARE`;
      await tx.$queryRaw`SELECT "staffId" FROM "StaffCredential" WHERE "staffId"=${input.actor.staffId} FOR SHARE`;
    } else await tx.$queryRaw`SELECT id FROM "OperatorAuthority" WHERE issuer='dashboard-admin' FOR SHARE`;
    const access = await accessReader.readAccess(input, { tx });
    if (!access.capabilities.finance && !access.capabilities.inventory_read) bad();
    const scope = { tenantId: input.tenantId, principalKey: access.principalKey };
    const issuer = input.actor.staffId ? null : await tx.operatorAuthority.findUnique({ where: { issuer: 'dashboard-admin' } });
    if (!input.actor.staffId && (!issuer || issuer.state !== 'active' || issuer.principalKey !== access.principalKey)) bad();
    let subject = await tx.operatorSubject.findUnique({ where: { tenantId_principalKey: scope } });
    if (!subject) subject = await tx.operatorSubject.create({ data: { id: randomUUID(), ...scope, kind: issuer ? 'admin' : 'staff',
      staffSourceId: input.actor.staffId || null, authorityId: issuer?.id || null, state: 'active', createdAt: clock(), updatedAt: clock() } });
    await tx.$queryRaw`SELECT id FROM "OperatorSubject" WHERE id=${subject.id} FOR UPDATE`;
    if (subject.state === 'deleted') bad();
    if (subject.state !== 'active') subject = await tx.operatorSubject.update({ where: { id: subject.id }, data: { state: 'active', updatedAt: clock() } });
    return { scope, subject, issuer, access, credentialEpoch: issuer ? issuer.credentialEpoch : subject.credentialEpoch, adminGeneration: issuer ? adminGeneration(issuer) : null };
  }
  async function route(tenantId, tx) {
    const conf = routeConfig();
    if (!conf.receiver || !conf.hash) bad('OPERATOR_ROUTE_UNAVAILABLE', 'La línea de WhatsApp del establecimiento no está verificada.', 409);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`operator-route:${conf.receiver}`}))::text`;
    const tenants = await tx.tenant.findMany({ where: { active: true, phone: conf.receiver }, select: { id: true } });
    if (tenants.length !== 1 || tenants[0].id !== tenantId) bad('OPERATOR_ROUTE_UNAVAILABLE', 'La línea de WhatsApp no corresponde a este establecimiento.', 409);
    const channel = await tx.channel.findFirst({ where: { type: 'whatsapp', active: true, OR: [{ tenantId }, { tenantId: null }] }, orderBy: [{ tenantId: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }] });
    if (!channel) bad('OPERATOR_ROUTE_UNAVAILABLE', 'No hay un canal de WhatsApp activo.', 409);
    let current = await tx.operatorChannelRoute.findFirst({ where: { tenantId, channelId: channel.id, provider: 'whatsapp', receiver: conf.receiver } });
    if (!current) current = await tx.operatorChannelRoute.create({ data: { id: randomUUID(), tenantId, channelId: channel.id, provider: 'whatsapp', receiver: conf.receiver, configHash: conf.hash,
      state: 'enabled', createdAt: clock(), updatedAt: clock() } });
    else if (current.state !== 'enabled' || current.configHash !== conf.hash) current = await tx.operatorChannelRoute.update({ where: { id: current.id }, data: { state: 'enabled', configHash: conf.hash, version: { increment: 1 }, updatedAt: clock() } });
    return current;
  }
  async function audit(tx, scope, eventCode, causeKey, evidence = {}) {
    return tx.operatorAudit.create({ data: { id: randomUUID(), tenantId: scope.tenantId, ownerPrincipalKey: scope.principalKey,
      actorKind: 'operator', actorPrincipalKey: scope.principalKey, eventCode, causeKey: p.digest([eventCode,causeKey]), evidence, createdAt: clock() } });
  }
  async function closeLink(tx, link, reason = 'revoked') {
    if (link.state !== 'active') return;
    const at = clock();
    const sessions = await tx.operatorSession.findMany({ where: { linkId: link.id, state: 'active' }, orderBy: { participantId: 'asc' } });
    for (const s of sessions) {
      await tx.$queryRaw`SELECT id FROM "OperatorParticipant" WHERE id=${s.participantId} FOR UPDATE`;
      await tx.operatorSession.update({ where: { id: s.id }, data: { state: 'revoked', closeReason: reason, closedAt: at } });
      const participant = await tx.operatorParticipant.findUnique({ where: { id: s.participantId } });
      if (participant?.currentSessionId === s.id) await tx.operatorParticipant.update({ where: { id: participant.id }, data: { mode: 'blocked', blockedReason: reason, currentSessionId: null, modeVersion: { increment: 1 }, updatedAt: at } });
    }
    await tx.operatorInteraction.updateMany({ where: { session: { linkId: link.id }, state: { in: ['prepared','offered'] } }, data: { state: 'invalidated' } });
    await tx.operatorThread.updateMany({ where: { linkId: link.id, state: 'open' }, data: { state: 'closed', closedAt: at, version: { increment: 1 } } });
    await tx.operatorLink.update({ where: { id: link.id }, data: { state: reason === 'replaced' ? 'replaced' : 'revoked', closeReason: reason, closedAt: at, version: { increment: 1 } } });
    await audit(tx, link, 'link_closed', link.id, { reason });
  }
  async function status(input) {
    if (!authority.settings.enabled) return { enabled: false, links: [], challenge: null };
    return run(async tx => {
      const { scope } = await source(input, tx);
      const links = await tx.operatorLink.findMany({ where: scope, orderBy: { createdAt: 'desc' }, take: 5, include: { currentAuthorization: true } });
      const challenge = await tx.operatorLinkChallenge.findFirst({ where: { ...scope, state: { in: ['pending','proved'] }, expiresAt: { gt: clock() } }, orderBy: { createdAt: 'desc' } });
      const issues = await tx.inboundJob.findMany({ where: { channelTenantId: scope.tenantId, channelPrincipalKey: scope.principalKey, status: { in: ['failed','needs_review'] } },
        orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, phase: true, createdAt: true, channelParticipantId: true, channelOrdinal: true } });
      const unresolved = [];
      for (const issue of issues) {
        const participant = await tx.operatorParticipant.findUnique({ where: { id: issue.channelParticipantId } });
        if (participant && participant.resolvedOrdinal + 1n === issue.channelOrdinal) {
          const work = await tx.operatorInboundWork.findFirst({ where: { jobId: issue.id }, include: { action: true, operationalRequest: true } });
          const reserved = work?.requestKey ? await tx.operationalRequest.findFirst({ where: { ...scope, requestId: work.requestKey }, select: { taskId: true } }) : null;
          unresolved.push({ id: issue.id, phase: issue.phase, createdAt: issue.createdAt, taskId: work?.action?.taskId || work?.operationalRequest?.taskId || work?.result?.taskId || reserved?.taskId || null });
        }
      }
      return json({ enabled: true, tenantId: scope.tenantId, links: links.map(l => ({ id: l.id, phone: l.phone, state: l.state, expiresAt: l.currentAuthorization?.expiresAt })),
        challenge: challenge ? { id: challenge.id, phone: challenge.phone, state: challenge.state, expiresAt: challenge.expiresAt } : null, issues: unresolved });
    });
  }
  async function start(input, { phone, proof }) {
    ready(); if (typeof phone !== 'string' || !/^[1-9][0-9]{6,14}$/.test(phone)) bad('INVALID_PHONE', 'Escribe el número internacional sin + ni espacios.', 400);
    return run(async tx => {
      const current = await source(input, tx); const { scope, subject } = current;
      const verified = await authority.consumeRecent(tx, proof, 'link_start', scope, { phone });
      const r = await route(input.tenantId, tx); const at = clock();
      const recent = await tx.operatorLinkChallenge.findMany({ where: { ...scope, createdAt: { gt: new Date(+at - 3600000) } }, orderBy: { createdAt: 'desc' } });
      if (recent.length >= 3 || (recent[0] && +at - +recent[0].createdAt < 60000)) bad('LINK_RATE_LIMIT', 'Espera antes de generar otro código.', 429);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`operator-phone:${r.id}:${phone}`}))::text`;
      const conflict = await tx.operatorLink.findFirst({ where: { tenantId: input.tenantId, routeId: r.id, phone, state: 'active', principalKey: { not: scope.principalKey } } });
      const pendingOther = await tx.operatorLinkChallenge.findFirst({ where: { tenantId: input.tenantId, routeId: r.id, phone, state: { in: ['pending','proved'] }, expiresAt: { gt: at }, principalKey: { not: scope.principalKey } } });
      if (conflict || pendingOther) bad('PHONE_ALREADY_LINKED', 'Ese número ya tiene una vinculación en curso o activa.', 409);
      await tx.operatorLinkChallenge.updateMany({ where: { ...scope, state: { in: ['pending','proved'] } }, data: { state: 'cancelled', finishedAt: at } });
      // Expired foreign challenges release the pending slot without touching their ownership.
      await tx.operatorLinkChallenge.updateMany({ where: { routeId: r.id, phone, state: { in: ['pending','proved'] }, expiresAt: { lte: at } }, data: { state: 'expired', finishedAt: at } });
      const previous = await tx.operatorLink.findFirst({ where: { ...scope, routeId: r.id, state: 'active' } });
      const code = randomBytes(5).toString('hex').toUpperCase(); const id = randomUUID();
      const challenge = await tx.operatorLinkChallenge.create({ data: { id, ...scope, subjectId: subject.id, routeId: r.id, routeVersion: r.version, phone,
        credentialEpoch: current.credentialEpoch, adminGeneration: current.adminGeneration, codeDigest: p.mac(authority.settings.key, 'link-code', { receiver: r.receiver, phone, code }),
        keyVersion: authority.settings.keyVersion, startProofId: verified.id, replacesLinkId: previous?.id || null, state: 'pending', createdAt: at, expiresAt: new Date(+at + 300000) } });
      await audit(tx, scope, 'challenge_started', id);
      return { id, code, command: `/vincular ${code}`, expiresAt: challenge.expiresAt.toISOString() };
    });
  }
  async function prove(tx, job, participant) {
    const at = clock();
    const challenges = await tx.operatorLinkChallenge.findMany({ where: { routeId: participant.routeId, phone: participant.phone, state: 'pending', expiresAt: { gt: at } } });
    for (const c of challenges) {
      await tx.$queryRaw`SELECT id FROM "OperatorLinkChallenge" WHERE id=${c.id} FOR UPDATE`;
      if (c.keyVersion === authority.settings.keyVersion && p.equal(c.codeDigest, job.payload.codeDigest)) {
        await tx.operatorLinkChallenge.update({ where: { id: c.id }, data: { state: 'proved', provedAt: at, phoneProofJobId: job.id } });
        await audit(tx, c, 'phone_proved', job.id); return 'link_proved';
      }
      const count = c.failedAttempts + 1;
      await tx.operatorLinkChallenge.update({ where: { id: c.id }, data: { failedAttempts: count, ...(count >= 5 ? { state: 'exhausted', finishedAt: at } : {}) } });
    }
    return 'link_not_verified';
  }
  async function activate(input, { challengeId, proof }) {
    ready(); return run(async tx => {
      const current = await source(input, tx); const { scope } = current;
      const c = await tx.operatorLinkChallenge.findFirst({ where: { id: challengeId, ...scope } });
      if (c?.state === 'consumed') {
        const existing = await tx.operatorLink.findUnique({ where: { challengeId: c.id }, include: { currentAuthorization: true } });
        if (existing) return { id: existing.id, phone: existing.phone, state: existing.state, expiresAt: existing.currentAuthorization.expiresAt.toISOString() };
      }
      if (!c || c.state !== 'proved' || c.expiresAt <= clock()) bad('LINK_CHALLENGE_EXPIRED', 'Verifica el teléfono y activa el vínculo antes de cinco minutos.', 409);
      const r = await route(input.tenantId, tx);
      if (c.credentialEpoch !== current.credentialEpoch || c.adminGeneration !== current.adminGeneration || c.routeId !== r.id || c.routeVersion !== r.version) bad();
      const verified = await authority.consumeRecent(tx, proof, 'link_activate', scope, { challengeId });
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`operator-phone:${r.id}:${c.phone}`}))::text`;
      const active = await tx.operatorLink.findMany({ where: { tenantId: input.tenantId, routeId: r.id, state: 'active', OR: [{ principalKey: scope.principalKey }, { phone: c.phone }] } });
      if (active.some(l => l.principalKey !== scope.principalKey)) bad('PHONE_ALREADY_LINKED', 'El número pertenece a otro vínculo.', 409);
      for (const old of active) await closeLink(tx, old, 'replaced');
      const at = clock(), linkId = randomUUID(), authorizationId = randomUUID();
      await tx.operatorLinkChallenge.update({ where: { id: c.id }, data: { state: 'consumed', activationProofId: verified.id, finishedAt: at } });
      await tx.operatorLink.create({ data: { id: linkId, ...scope, subjectId: current.subject.id, routeId: r.id, phone: c.phone, challengeId: c.id,
        credentialEpoch: current.credentialEpoch, adminGeneration: current.adminGeneration, state: 'active', currentAuthorizationId: authorizationId, createdAt: at } });
      await tx.operatorAuthorization.create({ data: { id: authorizationId, ...scope, linkId, number: 1n, proofId: verified.id, credentialEpoch: current.credentialEpoch,
        adminGeneration: current.adminGeneration, routeVersion: r.version, issuedAt: at, expiresAt: new Date(+at + 28800000) } });
      await tx.operatorThread.create({ data: { id: randomUUID(), ...scope, linkId, routeId: r.id, state: 'open', createdAt: at } });
      await audit(tx, scope, 'link_activated', linkId);
      return { id: linkId, phone: c.phone, state: 'active', expiresAt: new Date(+at + 28800000).toISOString() };
    });
  }
  async function renew(input, { linkId, proof }) {
    ready(); return run(async tx => {
      const current = await source(input, tx); const l = await tx.operatorLink.findFirst({ where: { ...current.scope, id: linkId }, include: { currentAuthorization: true } });
      if (!l || l.state !== 'active' || l.credentialEpoch !== current.credentialEpoch || l.adminGeneration !== current.adminGeneration) bad();
      const r = await route(input.tenantId, tx); if (l.routeId !== r.id) bad();
      const verified = await authority.consumeRecent(tx, proof, 'link_renew', current.scope, { linkId });
      const at = clock(), id = randomUUID();
      // The old session is fenced; renewal never revives its buttons.
      const sessions = await tx.operatorSession.findMany({ where: { linkId, state: 'active' }, orderBy: { participantId: 'asc' } });
      for (const s of sessions) {
        await tx.$queryRaw`SELECT id FROM "OperatorParticipant" WHERE id=${s.participantId} FOR UPDATE`;
        await tx.operatorSession.update({ where: { id: s.id }, data: { state: 'closed', closedAt: at, closeReason: 'renewed' } });
        await tx.operatorParticipant.update({ where: { id: s.participantId }, data: { mode: 'blocked', blockedReason: 'renewed', currentSessionId: null, modeVersion: { increment: 1 }, updatedAt: at } });
      }
      await tx.operatorAuthorization.create({ data: { id, ...current.scope, linkId, number: l.currentAuthorization.number + 1n, proofId: verified.id, credentialEpoch: current.credentialEpoch,
        adminGeneration: current.adminGeneration, routeVersion: r.version, issuedAt: at, expiresAt: new Date(+at + 28800000) } });
      await tx.operatorLink.update({ where: { id: linkId }, data: { currentAuthorizationId: id, version: { increment: 1 } } });
      await audit(tx, current.scope, 'authorization_renewed', id); return { id: linkId, expiresAt: new Date(+at + 28800000).toISOString() };
    });
  }
  async function revoke(input, linkId) {
    ready(); return run(async tx => { const { scope } = await source(input, tx); const link = await tx.operatorLink.findFirst({ where: { ...scope, id: linkId } });
      if (!link) bad('LINK_NOT_FOUND', 'Vínculo no encontrado.', 404); await closeLink(tx, link); return { id: link.id, state: 'revoked' }; });
  }
  async function acknowledge(input, { jobId }) {
    ready(); return run(async tx => {
      const { scope } = await source(input, tx);
      const job = await tx.inboundJob.findFirst({ where: { id: jobId, channelTenantId: scope.tenantId, channelPrincipalKey: scope.principalKey, status: { in: ['failed','needs_review'] } } });
      if (!job) bad('JOB_NOT_FOUND', 'Mensaje pendiente no encontrado.', 404);
      await tx.$queryRaw`SELECT id FROM "OperatorParticipant" WHERE id=${job.channelParticipantId} FOR UPDATE`;
      const participant = await tx.operatorParticipant.findUnique({ where: { id: job.channelParticipantId } });
      if (participant.resolvedOrdinal === job.channelOrdinal) return { acknowledged: true };
      if (participant.resolvedOrdinal + 1n !== job.channelOrdinal) bad('PREVIOUS_MESSAGE_PENDING', 'Revisa primero el mensaje anterior.', 409);
      const receipts = await tx.operatorInboundWork.findMany({ where: { jobId, kind: 'confirm' }, include: { action: { include: { receipts: true } } } });
      await tx.operatorParticipant.update({ where: { id: participant.id }, data: { resolvedOrdinal: job.channelOrdinal, updatedAt: clock() } });
      await audit(tx, scope, 'job_review_acknowledged', job.id, { jobId, receiptIds: receipts.flatMap(w=>w.action?.receipts.map(r=>r.id) || []) });
      return { acknowledged: true, receiptIds: receipts.flatMap(w=>w.action?.receipts.map(r=>r.id) || []) };
    });
  }
  return { run, source, route, status, start, prove, activate, renew, revoke, acknowledge, closeLink, audit };
}
module.exports = { buildOperatorLinking, scopeOf };
