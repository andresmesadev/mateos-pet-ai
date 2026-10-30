const prisma = require('../../../../lib/prisma');
const { outbound } = require('../../../../services/whatsapp-route.service');
const { providerScope, routeSnapshot } = require('../../../../lib/provider-execution');

async function findConfiguredWhatsAppTenant(tenantId) {
  const route = await outbound(tenantId);
  return route ? { id: tenantId, phone: route.receiver, active: true, route } : null;
}

async function assertWhatsAppRoute(route) {
  const reject = () => {
    const error = new Error('No hay una conexión de WhatsApp habilitada para este establecimiento.');
    error.code = 'WHATSAPP_ROUTE_NOT_CONFIGURED';
    throw error;
  };
  if (typeof route?.channelId !== 'string' || !route.channelId) reject();
  const scope = providerScope();
  if (scope && scope.tenantId !== route.tenantId) reject();
  if (scope?.routeUnavailable) reject();
  const credentials = await outbound(route.tenantId, scope?.whatsapp ? routeSnapshot(scope.whatsapp) : null);
  if (!credentials || (credentials.channelId && credentials.channelId !== route.channelId)) reject();
  const channel = await prisma.channel.findUnique({ where: { id: route.channelId }, select: { tenantId: true, type: true, active: true } });
  if (!channel || channel.type !== 'whatsapp' || channel.active !== true || (channel.tenantId !== null && channel.tenantId !== route.tenantId)) reject();
  return credentials;
}

module.exports = { findConfiguredWhatsAppTenant, assertWhatsAppRoute };
