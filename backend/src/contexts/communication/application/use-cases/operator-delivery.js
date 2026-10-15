const { randomUUID } = require('node:crypto');
const p = require('../../../../application/operator-channel/protocol');
const { fail } = require('../../../agents/application/operational/policy');
const { projection } = require('../../../../application/operator-channel/access');
const { fits } = require('../../../../application/operator-channel/message-limits');
const CONTROLS = Object.freeze({ link_proved: 'Teléfono verificado. Vuelve al dashboard y activa el vínculo antes de que venza el código.',
  link_invalid: 'No se pudo verificar el código. Revisa el vínculo en el dashboard.', access_denied: 'No hay un acceso privado vigente. Verifica el vínculo en el dashboard y escribe /negocio.',
  session_expired: 'La sesión privada venció. Escribe /negocio; si la autorización venció, renuévala en el dashboard.',
  use_dashboard: 'Continúa esta operación desde el dashboard para revisar todos sus datos.', use_text: 'En el modo negocio utiliza mensajes de texto.', customer_mode: 'Modo clientes activado. Para volver a tus empleados escribe /negocio.' });
function buildOperatorDelivery({ prisma, access, authority, routeConfig, provider, clock = () => new Date() }) {
  async function run(fn) { return prisma.$transaction(async tx => { await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'"); return fn(tx); }, { maxWait: 2000, timeout: 10000 }); }
  async function audit(tx, d, event, attempt, evidence = {}) {
    await tx.operatorAudit.create({ data: { id: randomUUID(), tenantId: d.tenantId, ownerPrincipalKey: d.principalKey, actorKind: 'service', eventCode: event,
      causeKey: p.digest([d.id, attempt, event]), evidence, deliveryId: d.id, attemptNumber: attempt, createdAt: clock() } });
  }
  async function prepare(tx, job, { message, controlCode, ordinal = 0 }) {
    if (!message && !CONTROLS[controlCode]) fail('INVALID_CONTROL', 'Control no válido.', 400);
    return tx.operatorDelivery.upsert({ where: { sourceJobId_replyOrdinal: { sourceJobId: job.id, replyOrdinal: ordinal } }, update: {}, create: {
      id: randomUUID(), tenantId: job.channelTenantId, principalKey: message?.principalKey || null, routeId: job.channelRouteId, routeVersion: job.channelRouteVersion,
      participantId: job.channelParticipantId, sessionId: message?.sessionId || null, messageId: message?.id || null, sourceJobId: job.id, replyOrdinal: ordinal,
      kind: message ? 'private' : 'control', controlCode: message ? null : controlCode, modeVersion: job.channelModeVersion,
      permissionEpoch: message?.permissionEpoch || null, tenantAccessEpoch: message?.tenantAccessEpoch || null, state: 'prepared', createdAt: clock(), updatedAt: clock() } });
  }
  async function send(id) {
    // This committed fence survives rollback/crash of the provider transaction.
    const reserved = await run(async tx => {
      await tx.$queryRaw`SELECT id FROM "OperatorDelivery" WHERE id=${id} FOR UPDATE`;
      const d = await tx.operatorDelivery.findUnique({ where: { id } });
      if (!d) fail('DELIVERY_NOT_FOUND', 'Entrega no encontrada.', 404);
      if (['accepted','blocked','uncertain'].includes(d.state)) return { terminal: d.state };
      if (d.state === 'sending') {
        if (d.claimUntil > clock()) return { terminal: 'busy' };
        await tx.operatorDelivery.update({ where: { id }, data: { state: 'uncertain', claimOwner: null, claimUntil: null, lastErrorCode: 'INTERRUPTED_PROVIDER_ATTEMPT', updatedAt: clock() } });
        return { terminal: 'uncertain' };
      }
      if (d.attemptCount >= 4) return { terminal: 'rejected' };
      const attempt = d.attemptCount + 1;
      const updated = await tx.operatorDelivery.update({ where: { id }, data: { state: 'sending', claimGeneration: { increment: 1 }, claimOwner: randomUUID(),
        claimUntil: new Date(+clock() + 30000), attemptCount: attempt, updatedAt: clock() } });
      await audit(tx, updated, 'attempt_reserved', attempt);
      return updated;
    });
    if (reserved.terminal) return { state: reserved.terminal };
    let input, proof;
    if (reserved.kind === 'private') {
      try { input = await access.identity(reserved.sessionId, 'deliver'); proof = await access.acquire(input); }
      catch { return block(reserved, 'ACCESS_UNAVAILABLE'); }
    }
    try {
      return await run(async tx => {
        const ctx = { tx, operatorProof: proof }; let privateAccess;
        if (input) privateAccess = await access.check(input, ctx);
        await tx.$queryRaw`SELECT id FROM "OperatorChannelRoute" WHERE id=${reserved.routeId} FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM "OperatorParticipant" WHERE id=${reserved.participantId} FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM "OperatorDelivery" WHERE id=${id} FOR UPDATE`;
        const d = await tx.operatorDelivery.findUnique({ where: { id }, include: { message: true, route: { include: { channel: true, tenant: true } }, participant: true, source: true } });
        if (d.state !== 'sending' || d.claimOwner !== reserved.claimOwner || d.claimGeneration !== reserved.claimGeneration || d.claimUntil <= clock()) fail('DELIVERY_CLAIM_LOST', 'Entrega recuperada por otro proceso.', 409);
        let reason;
        const receivedAt = /^\d{10}$/.test(String(d.source.payload.timestamp || '')) ? Number(d.source.payload.timestamp) * 1000 : NaN;
        if (!authority.settings.enabled || d.route.state !== 'enabled' || d.route.version !== d.routeVersion || d.route.receiver !== routeConfig().receiver || d.route.configHash !== routeConfig().hash ||
            !d.route.channel.active || !d.route.tenant.active || d.route.tenant.phone !== d.route.receiver || d.participant.modeVersion !== d.modeVersion ||
            d.source.channelModeVersion !== d.modeVersion || +clock() - +d.source.createdAt > 86400000 || !Number.isFinite(receivedAt) || receivedAt > +clock()+5000 || +clock()-receivedAt>86400000) reason = 'ROUTE_OR_MODE_CHANGED';
        if (d.kind === 'private') {
          const a = privateAccess; const m = d.message;
          if (!a || !m || a.subject.permissionEpoch !== d.permissionEpoch || a.tenant.operatorAccessEpoch !== d.tenantAccessEpoch || m.permissionEpoch !== a.subject.permissionEpoch ||
              p.digest(m.accessProjection) !== p.digest(projection(a.access)) ||
              (m.accessClass !== 'private_generic' && !a.access.capabilities[m.accessClass])) reason = 'PERMISSIONS_CHANGED';
        }
        if (reason) {
          await tx.operatorDelivery.update({ where: { id }, data: { state: 'blocked', claimOwner: null, claimUntil: null, blockedReason: reason, updatedAt: clock() } });
          await audit(tx, d, 'delivery_blocked', d.attemptCount, { code: reason }); return { state: 'blocked' };
        }
        const text = d.kind === 'control' ? CONTROLS[d.controlCode] : d.message.content.text;
        const interactions = d.message ? await tx.operatorInteraction.findMany({ where: { messageId: d.message.id, state: 'prepared', expiresAt: { gt: clock() } }, orderBy: { id: 'asc' }, take: 3 }) : [];
        if (!fits(text, interactions.length > 0)) fail('PRIVATE_REPLY_TOO_LARGE', 'Consulta el resultado completo en el dashboard.', 422);
        const buttons = interactions.map(i => ({ token: `op1.${p.mac(authority.settings.key, 'outgoing-button', i.id)}`, title: i.kind === 'confirm' ? 'Confirmar operación' : i.kind === 'select_product' ? `Elegir producto ${i.selectionContext.ordinal}` : 'Ver más resultados' }));
        await audit(tx, d, 'provider_call_authorized', d.attemptCount);
        let result;
        try { result = await provider({ receiver: d.route.receiver, phone: d.participant.phone, text, buttons }); }
        catch { result = { state: 'uncertain', code: 'PROVIDER_ACCEPTANCE_UNKNOWN' }; }
        if (!['accepted','rejected','uncertain'].includes(result?.state) || (result.state === 'accepted' && typeof result.messageId !== 'string')) result = { state: 'uncertain', code: 'PROVIDER_ACCEPTANCE_UNKNOWN' };
        await tx.operatorDelivery.update({ where: { id }, data: { state: result.state, claimOwner: null, claimUntil: null, updatedAt: clock(),
          ...(result.state === 'accepted' ? { providerMessageId: result.messageId, acceptedAt: clock(), lastErrorCode: null } : { lastErrorCode: result.state === 'rejected' ? 'PROVIDER_REJECTED' : 'PROVIDER_ACCEPTANCE_UNKNOWN' }) } });
        if (result.state === 'accepted') for (const i of interactions) await tx.operatorInteraction.update({ where: { id: i.id }, data: { state: 'offered', offeredAt: clock(), providerMessageId: result.messageId } });
        await audit(tx, d, `delivery_${result.state}`, d.attemptCount);
        return { state: result.state };
      });
    } catch (e) {
      if (e.status) return block(reserved, 'ACCESS_UNAVAILABLE');
      // The durable sending fence remains. Recovery must treat the call as unknown.
      throw e;
    }
  }
  async function block(d, code) {
    return run(async tx => {
      const changed = await tx.operatorDelivery.updateMany({ where: { id: d.id, state: 'sending', claimOwner: d.claimOwner, claimGeneration: d.claimGeneration },
        data: { state: 'blocked', claimOwner: null, claimUntil: null, blockedReason: code, updatedAt: clock() } });
      if (!changed.count) return { state: (await tx.operatorDelivery.findUnique({ where: { id: d.id } }))?.state || 'uncertain' };
      await audit(tx, d, 'delivery_blocked', d.attemptCount, { code }); return { state: 'blocked' };
    });
  }
  return { prepare, send, controls: CONTROLS };
}
module.exports = { buildOperatorDelivery, CONTROLS };
