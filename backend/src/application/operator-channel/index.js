const p = require('./protocol');
const { buildOperatorAuthority } = require('./authority');
const { buildOperatorAccess } = require('./access');
const { buildOperatorLinking } = require('./linking');
const { buildOperatorSessions } = require('./sessions');
const { buildOperatorCoordinator } = require('./coordinator');
const { parseOperatorInputs, customerPayload } = require('./ingress');
const { buildOperatorDelivery } = require('../../contexts/communication/application/use-cases/operator-delivery');
const { buildOperatorWhatsappProvider } = require('../../contexts/communication/infrastructure/providers/operator-whatsapp-provider');
const { buildOperationalInterpreter } = require('../../contexts/agents/infrastructure/operational/interpreter');
const { buildOperatorMaintenance } = require('./maintenance');
function buildOperatorChannel({ prisma, accessReader, buildOperational, env = process.env, fetcher, provider, clock, settings = p.config(env) }) {
  const routeConfig = () => ({ receiver: env.WHATSAPP_PHONE_NUMBER_ID || '', hash: env.WHATSAPP_ACCESS_TOKEN ? p.mac(settings.key, 'route-config', {
    receiver: env.WHATSAPP_PHONE_NUMBER_ID || '', keyVersion: settings.keyVersion, tokenFingerprint: p.digest(env.WHATSAPP_ACCESS_TOKEN) }) : null });
  const authority = buildOperatorAuthority({ prisma, settings, fetcher, issuerUrl: env.OPERATOR_AUTHORITY_URL, clock });
  const access = buildOperatorAccess({ prisma, authority, accessReader, routeConfig, clock });
  const linking = buildOperatorLinking({ prisma, authority, accessReader, routeConfig, clock });
  const sessions = buildOperatorSessions({ prisma, authority, linking, routeConfig, clock });
  const operational = buildOperational(access);
  const delivery = buildOperatorDelivery({ prisma, authority, access, routeConfig, clock, provider: provider || buildOperatorWhatsappProvider({ env }) });
  const coordinator = buildOperatorCoordinator({ prisma, operational, access, authority, delivery, clock, interpret: buildOperationalInterpreter() });
  async function ingress(body, enqueue) {
    const handled = new Set(); let created = false;
    for (const input of parseOperatorInputs(body, settings)) {
      let routes = [];
      if (settings.enabled || routeConfig().receiver === input.receiver) {
        try { routes = await prisma.operatorChannelRoute.findMany({ where: { provider: 'whatsapp', receiver: input.receiver }, include: { tenant: true, channel: true } }); }
        catch (e) { if (settings.enabled || e.code !== 'P2021') throw e; }
      }
      const r = routes.find(r => r.state === 'enabled' && r.tenant.active && r.channel.active && r.tenant.phone === input.receiver &&
        r.receiver === routeConfig().receiver && r.configHash === routeConfig().hash);
      if (r && settings.enabled) {
        const result = await enqueue({ route: r, input }); created ||= result.created; handled.add(input.id);
      } else if (input.reserved) handled.add(input.id);
      else if (routes.length) {
        const privateParticipant = await prisma.operatorParticipant.findFirst({ where: { routeId: { in: routes.map(r=>r.id) }, phone: input.from, mode: { not: 'customer' } } });
        if (privateParticipant) handled.add(input.id);
      }
    }
    return { handled, created };
  }
  async function process(job) {
    const classified = await sessions.classify(job);
    if (classified.channelResultKind === 'customer') return { job: classified, customerPayload: customerPayload(job.payload), replies: null };
    try { return { job: classified, replies: await coordinator.process(classified) }; }
    catch (e) {
      if (!e.status) throw e;
      return { job: classified, replies: await coordinator.control(classified, e.status === 403 ? 'access_denied' : 'use_dashboard') };
    }
  }
  async function guardCustomerReply(job, reply, send) {
    if (!settings.enabled && !routeConfig().receiver) return send();
    return prisma.$transaction(async tx => {
      let participant;
      if (job.envelopeVersion === 2) {
        await tx.$queryRaw`SELECT id FROM "OperatorParticipant" WHERE id=${job.channelParticipantId} FOR SHARE`;
        participant = await tx.operatorParticipant.findUnique({ where: { id: job.channelParticipantId } });
        if (!participant || participant.mode !== 'customer' || participant.modeVersion !== job.channelModeVersion) return;
      } else {
        const route = await tx.operatorChannelRoute.findFirst({ where: { receiver: routeConfig().receiver, tenantId: reply.tenantId } });
        if (route) {
          const found = await tx.operatorParticipant.findUnique({ where: { tenantId_routeId_phone: { tenantId: reply.tenantId, routeId: route.id, phone: String(reply.phone).replace(/^\+/, '') } } });
          if (found) { await tx.$queryRaw`SELECT id FROM "OperatorParticipant" WHERE id=${found.id} FOR SHARE`; participant = await tx.operatorParticipant.findUnique({ where: { id: found.id } }); }
          if (participant && participant.mode !== 'customer') return;
        }
      }
      return send();
    }, { maxWait: 2000, timeout: 30000 });
  }
  return { operational, authority, access, linking, sessions, delivery, coordinator, ingress, process, guardCustomerReply, maintain: buildOperatorMaintenance({ prisma, clock }) };
}
module.exports = { buildOperatorChannel };
