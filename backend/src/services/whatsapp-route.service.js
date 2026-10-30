const prisma = require('../lib/prisma');
const { decryptProviderToken } = require('./provider-credential.service');
const { isWhatsAppEnabled } = require('../lib/whatsapp-runtime');
const { providerScope, runProviderScope, routeSnapshot } = require('../lib/provider-execution');

function buildWhatsAppRoutes({ db = prisma, env = process.env, clock = () => new Date() } = {}) {
  async function outbound(tenantId, expected = null) {
    if (!isWhatsAppEnabled(env) || typeof tenantId !== 'string' || !tenantId) return null;
    const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true, phone: true, active: true } });
    if (!tenant?.active) return null;
    const connection = await db.whatsAppConnection.findUnique({ where: { tenantId } });
    let route;
    if (connection) {
      if (String(env.WHATSAPP_MULTITENANT_ENABLED || '').toLowerCase() !== 'true') return null;
      if (connection.status !== 'enabled' || !connection.encryptedToken || tenant.phone !== connection.phoneNumberId || (connection.tokenExpiresAt && connection.tokenExpiresAt <= clock())) return null;
      route = { tenantId, receiver: connection.phoneNumberId, wabaId: connection.wabaId, channelId: connection.channelId,
        connectionId: connection.id, routeVersion: connection.routeVersion,
        accessToken: decryptProviderToken(connection.encryptedToken, tenantId, connection.id, env) };
    } else {
      const receiver = String(env.WHATSAPP_PHONE_NUMBER_ID || '').trim(), accessToken = String(env.WHATSAPP_ACCESS_TOKEN || '').trim();
      if (!receiver || !accessToken || tenant.phone !== receiver) return null;
      route = { tenantId, receiver, accessToken, wabaId: null, channelId: null, connectionId: null, routeVersion: 0 };
    }
    if (expected && (expected.tenantId !== tenantId || expected.receiver !== route.receiver ||
      expected.connectionId !== route.connectionId || expected.routeVersion !== route.routeVersion)) return null;
    return route;
  }
  async function receiver(phoneNumberId, wabaId = null, expected = null) {
    if (typeof phoneNumberId !== 'string' || !/^\d{1,64}$/.test(phoneNumberId) || !isWhatsAppEnabled(env)) return null;
    const connection = await db.whatsAppConnection.findUnique({ where: { phoneNumberId } });
    if (connection && (!wabaId || wabaId !== connection.wabaId)) return null;
    const tenant = connection ? { id: connection.tenantId } : await db.tenant.findUnique({ where: { phone: phoneNumberId }, select: { id: true } });
    if (!tenant) return null;
    return outbound(tenant.id, expected);
  }
  async function withTenant(tenantId, fn, expected = null) {
    let route;
    try { route = await outbound(tenantId, expected); } catch { route = null; }
    return runProviderScope({ tenantId, whatsapp: route, routeUnavailable: !route }, fn);
  }
  return { outbound, receiver, withTenant };
}
// Resolve runtime configuration at the call boundary, including pause/rotation.
const routes = Object.fromEntries(['outbound','receiver','withTenant'].map(name => [name, (...args) => buildWhatsAppRoutes()[name](...args)]));
async function currentWhatsAppRoute(expected) {
  const scope = providerScope();
  const tenantId = expected?.tenantId ?? scope?.tenantId;
  if (!tenantId || (scope?.tenantId && tenantId !== scope.tenantId)) return null;
  if (scope?.routeUnavailable) return null;
  return routes.outbound(tenantId, expected ?? (scope?.whatsapp ? routeSnapshot(scope.whatsapp) : null));
}
module.exports = { buildWhatsAppRoutes, ...routes, currentWhatsAppRoute };
