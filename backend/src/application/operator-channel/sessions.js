const { randomUUID } = require('node:crypto');
const { fail } = require('../../contexts/agents/application/operational/policy');
const { adminGeneration } = require('./access');
function buildOperatorSessions({ prisma, authority, linking, routeConfig, clock = () => new Date() }) {
  async function actorFor(link) {
    if (link.subject.kind === 'admin') return { type: 'admin', email: link.principalKey.slice(6), name: 'Administrador' };
    const credential = await prisma.staffCredential.findUnique({ where: { staffId: link.subject.staffSourceId }, include: { staff: true } });
    if (!credential?.active || !credential.staff.active) return null;
    return { type: credential.staff.role, staffId: link.subject.staffSourceId, sessionVersion: credential.sessionVersion, name: credential.staff.name };
  }
  async function classify(job) {
    const candidate = await prisma.operatorLink.findFirst({ where: { tenantId: job.channelTenantId, routeId: job.channelRouteId, phone: job.payload.from, state: 'active' }, include: { subject: true } });
    const actor = candidate ? await actorFor(candidate) : null;
    let liveProof = null;
    if (candidate?.subject.kind === 'admin' && actor) {
      try { liveProof = await authority.live({ tenantId: job.channelTenantId, principalKey: candidate.principalKey, sessionId: null, purpose: 'access' }); } catch { /* sticky block, never customer fallback */ }
    }
    return linking.run(async tx => {
      let verifiedSource = null;
      if (candidate && actor) {
        try {
          verifiedSource = await linking.source({ tenantId: job.channelTenantId, actor }, tx);
          if (verifiedSource.issuer) {
            if (!liveProof) verifiedSource = null;
            else await authority.consumeLive(tx, liveProof, { ...verifiedSource.scope, purpose: 'access' });
          }
        } catch (e) { if (!e.status) throw e; verifiedSource = null; }
      }
      await tx.$queryRaw`SELECT id FROM "InboundJob" WHERE id=${job.id} FOR UPDATE`;
      const owned = await tx.inboundJob.findUnique({ where: { id: job.id } });
      if (!owned || owned.status !== 'claimed' || owned.channelClaimOwner !== job.channelClaimOwner || owned.channelClaimGeneration !== job.channelClaimGeneration || owned.leaseExpiresAt <= clock()) fail('CLAIM_LOST', 'El mensaje está siendo recuperado.', 409);
      if (owned.channelResultKind) return owned;
      await tx.$queryRaw`SELECT id FROM "OperatorParticipant" WHERE id=${job.channelParticipantId} FOR UPDATE`;
      let participant = await tx.operatorParticipant.findUnique({ where: { id: job.channelParticipantId } });
      const route = await tx.operatorChannelRoute.findUnique({ where: { id: job.channelRouteId }, include: { channel: true } });
      const tenant = await tx.tenant.findUnique({ where: { id: job.channelTenantId } });
      const now = clock(); let kind = 'blocked', session = null, code = 'access_denied';
      const eligible = authority.settings.enabled && route?.state === 'enabled' && route.version === job.channelRouteVersion && route.receiver === job.payload.receiver &&
        route.receiver === routeConfig().receiver && route.configHash === routeConfig().hash && route.channel.active && tenant?.active && tenant.phone === route.receiver;
      const fence = job.payload.admissionModeVersion === String(participant.modeVersion);
      async function close(reason) {
        if (participant.currentSessionId) await tx.operatorSession.updateMany({ where: { id: participant.currentSessionId, state: 'active' }, data: { state: 'closed', closedAt: now, closeReason: reason } });
        if (participant.mode !== 'blocked' || participant.currentSessionId) participant = await tx.operatorParticipant.update({ where: { id: participant.id }, data: { mode: 'blocked', currentSessionId: null, blockedReason: reason, modeVersion: { increment: 1 }, updatedAt: now } });
      }
      if (!eligible || !fence) { kind = 'blocked'; }
      else if (job.payload.kind === 'clientes') {
        participant = await tx.operatorParticipant.update({ where: { id: participant.id }, data: { mode: 'customer', currentSessionId: null, blockedReason: null, modeVersion: { increment: 1 }, updatedAt: now } });
        kind = 'control'; code = 'customer_mode';
      } else if (job.payload.kind === 'link') {
        kind = 'control'; code = (await linking.prove(tx, owned, participant)) === 'link_proved' ? 'link_proved' : 'link_invalid';
      } else if (job.payload.kind === 'negocio' || participant.mode === 'business') {
        const current = verifiedSource;
        const link = candidate ? await tx.operatorLink.findUnique({ where: { id: candidate.id }, include: { currentAuthorization: true, threads: true } }) : null;
        if (!current || !link || link.state !== 'active' || link.credentialEpoch !== current.credentialEpoch || link.adminGeneration !== (current.issuer ? adminGeneration(current.issuer) : null) ||
            link.currentAuthorization?.routeVersion !== route.version || link.currentAuthorization?.expiresAt <= now || link.threads[0]?.state !== 'open') {
          await close('access_expired'); kind = 'control'; code = 'access_denied';
        } else if (job.payload.kind === 'negocio') {
          const version = participant.modeVersion + 1n;
          session = await tx.operatorSession.create({ data: { id: randomUUID(), ...current.scope, linkId: link.id, authorizationId: link.currentAuthorizationId,
            participantId: participant.id, threadId: link.threads[0].id, credentialEpoch: current.credentialEpoch, routeVersion: route.version, modeVersion: version,
            openedOrdinal: job.channelOrdinal, lastActivityOrdinal: job.channelOrdinal, state: 'active', openedAt: now, lastActivityAt: now,
            idleExpiresAt: new Date(+now + 900000), absoluteExpiresAt: link.currentAuthorization.expiresAt } });
          participant = await tx.operatorParticipant.update({ where: { id: participant.id }, data: { mode: 'business', currentSessionId: session.id, blockedReason: null, modeVersion: version, updatedAt: now } });
          kind = 'operator';
        } else {
          session = await tx.operatorSession.findUnique({ where: { id: participant.currentSessionId } });
          if (!session || session.state !== 'active' || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now || session.authorizationId !== link.currentAuthorizationId || session.modeVersion !== participant.modeVersion) {
            await close('session_expired'); kind = 'control'; code = 'session_expired'; session = null;
          } else {
            session = await tx.operatorSession.update({ where: { id: session.id }, data: { lastActivityAt: now, lastActivityOrdinal: job.channelOrdinal, idleExpiresAt: new Date(+now + 900000) } }); kind = 'operator';
          }
        }
      } else if (participant.mode === 'customer' && !job.payload.reserved) kind = 'customer';
      else { kind = 'control'; code = 'access_denied'; }
      return tx.inboundJob.update({ where: { id: job.id }, data: { channelResultKind: kind, channelPrincipalKey: kind === 'operator' ? session.principalKey : null,
        channelSessionId: kind === 'operator' ? session.id : null, channelModeVersion: participant.modeVersion,
        replies: kind === 'control' ? [{ controlCode: code }] : [] } });
    });
  }
  return { classify };
}
module.exports = { buildOperatorSessions };
