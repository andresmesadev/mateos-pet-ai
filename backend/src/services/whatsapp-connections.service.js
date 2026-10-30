const { randomUUID, randomBytes, createHash } = require('node:crypto');
const prisma = require('../lib/prisma');
const { credentialKey, encryptProviderToken } = require('./provider-credential.service');
const { buildMetaWhatsAppConnection, providerError } = require('./meta-whatsapp-connection.service');
const hash = value => createHash('sha256').update(value).digest('hex');
const publicConnection = row => row ? { id: row.id, status: row.status, routeVersion: row.routeVersion, phoneNumberId: row.phoneNumberId,
  displayPhone: row.displayPhone, tokenExpiresAt: row.tokenExpiresAt, updatedAt: row.updatedAt } : null;

function buildWhatsAppConnections({ db = prisma, env = process.env, clock = () => new Date(), meta = buildMetaWhatsAppConnection({ env, clock }), authorize = async () => { throw providerError('ADMINISTRATOR_REQUIRED', 403); } } = {}) {
  const transaction = fn => db.$transaction(fn, { maxWait: 3000, timeout: 10000 });
  async function activeTenant(tx, tenantId) {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true, active: true, phone: true } });
    if (!tenant?.active) throw providerError('TENANT_NOT_ENABLED', 403);
    return tenant;
  }
  function readiness() {
    try { credentialKey(env); return { ready: true, ...meta.configuration() }; }
    catch { return { ready: false, reason: 'META_SIGNUP_NOT_CONFIGURED' }; }
  }
  async function status(tenantId) {
    return { setup: readiness(), connection: publicConnection(await db.whatsAppConnection.findUnique({ where: { tenantId } })) };
  }
  async function start({ tenantId, actorKey }) {
    if (!readiness().ready) throw providerError('META_SIGNUP_NOT_CONFIGURED', 503);
    if (typeof actorKey !== 'string' || !actorKey) throw providerError('ADMINISTRATOR_REQUIRED', 403);
    const state = randomBytes(32).toString('base64url'), expiresAt = new Date(+clock() + 600000);
    await activeTenant(db, tenantId);
    await authorize(db, tenantId);
    const current = await db.whatsAppConnection.findUnique({ where: { tenantId } });
    await db.whatsAppConnectionChallenge.create({ data: { id: randomUUID(), tenantId, stateHash: hash(state), actorHash: hash(actorKey), status: 'pending',
      expectedRouteVersion: current?.routeVersion ?? 0, expiresAt } });
    return { state, expiresAt, ...meta.configuration() };
  }
  async function complete({ tenantId, actorKey, state, code, wabaId, phoneNumberId }) {
    if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state) || typeof actorKey !== 'string' || !actorKey) throw providerError('INVALID_CONNECTION_CHALLENGE', 400);
    await activeTenant(db, tenantId);
    await authorize(db, tenantId);
    const challenge = await db.whatsAppConnectionChallenge.findUnique({ where: { stateHash: hash(state) } });
    if (!challenge || challenge.tenantId !== tenantId || challenge.actorHash !== hash(actorKey) || challenge.status !== 'pending' || challenge.expiresAt <= clock()) throw providerError('CONNECTION_CHALLENGE_EXPIRED', 409);
    const claimed = await db.whatsAppConnectionChallenge.updateMany({ where: { id: challenge.id, tenantId, actorHash: hash(actorKey), status: 'pending', expiresAt: { gt: clock() } }, data: { status: 'exchanging', consumedAt: clock() } });
    if (claimed.count !== 1) throw providerError('CONNECTION_CHALLENGE_USED', 409);
    try {
      const verified = await meta.verify({ code, wabaId, phoneNumberId });
      const result = await transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${tenantId} FOR UPDATE`;
        const tenant = await activeTenant(tx, tenantId);
        await authorize(tx, tenantId);
        const current = await tx.whatsAppConnection.findUnique({ where: { tenantId } });
        if ((current?.routeVersion ?? 0) !== challenge.expectedRouteVersion) throw providerError('CONNECTION_CHANGED', 409);
        if (current && (current.wabaId !== verified.wabaId || current.phoneNumberId !== verified.phoneNumberId)) throw providerError('NUMBER_CHANGE_REQUIRES_REVIEW', 409);
        const owner = await tx.tenant.findUnique({ where: { phone: verified.phoneNumberId }, select: { id: true } });
        if (owner && owner.id !== tenant.id) throw providerError('NUMBER_ALREADY_CONNECTED', 409);
        const account = await tx.whatsAppConnection.findUnique({ where: { wabaId: verified.wabaId } });
        if (account && account.tenantId !== tenantId) throw providerError('ACCOUNT_ALREADY_CONNECTED', 409);
        const channel = await tx.channel.upsert({ where: { tenantId_type: { tenantId, type: 'whatsapp' } }, update: { active: true }, create: { tenantId, type: 'whatsapp', active: true } });
        const id = current?.id ?? randomUUID();
        const data = { channelId: channel.id, wabaId: verified.wabaId, phoneNumberId: verified.phoneNumberId, displayPhone: verified.displayPhone,
          status: 'enabled', encryptedToken: encryptProviderToken(verified.token, tenantId, id, env), tokenExpiresAt: verified.tokenExpiresAt,
          routeVersion: (current?.routeVersion ?? 0) + 1 };
        const row = await tx.whatsAppConnection.upsert({ where: { tenantId }, create: { id, tenantId, ...data }, update: data });
        await tx.tenant.update({ where: { id: tenantId }, data: { phone: verified.phoneNumberId } });
        await tx.operatorChannelRoute.updateMany({ where: { tenantId }, data: { state: 'disabled', version: { increment: 1 }, updatedAt: clock() } });
        await tx.whatsAppConnectionChallenge.update({ where: { id: challenge.id }, data: { status: 'completed' } });
        await tx.whatsAppConnectionEvent.create({ data: { id: randomUUID(), tenantId, action: current ? 'reconnected' : 'connected', routeVersion: data.routeVersion, actorHash: hash(actorKey) } });
        return row;
      });
      return publicConnection(result);
    } catch (error) {
      await db.whatsAppConnectionChallenge.updateMany({ where: { id: challenge.id, status: 'exchanging' }, data: { status: 'failed' } }).catch(() => {});
      if (error.code === 'P2002') throw providerError('NUMBER_OR_ACCOUNT_ALREADY_CONNECTED', 409);
      throw error;
    }
  }
  async function disconnect({ tenantId, expectedVersion, actorKey }) {
    if (typeof actorKey !== 'string' || !actorKey) throw providerError('ADMINISTRATOR_REQUIRED', 403);
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw providerError('CONNECTION_VERSION_REQUIRED', 400);
    return transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${tenantId} FOR UPDATE`;
      await activeTenant(tx, tenantId);
      await authorize(tx, tenantId);
      const changed = await tx.whatsAppConnection.updateMany({ where: { tenantId, routeVersion: expectedVersion, status: 'enabled' },
        data: { status: 'revoked', encryptedToken: null, routeVersion: { increment: 1 } } });
      if (changed.count !== 1) throw providerError('CONNECTION_CHANGED', 409);
      await tx.operatorChannelRoute.updateMany({ where: { tenantId }, data: { state: 'disabled', version: { increment: 1 }, updatedAt: clock() } });
      await tx.whatsAppConnectionChallenge.updateMany({ where: { tenantId, status: 'pending' }, data: { status: 'failed', consumedAt: clock() } });
      await tx.whatsAppConnectionEvent.create({ data: { id: randomUUID(), tenantId, action: 'disconnected', routeVersion: expectedVersion + 1, actorHash: hash(actorKey) } });
      return { disconnected: true };
    });
  }
  return { status, start, complete, disconnect };
}
module.exports = { buildWhatsAppConnections, publicConnection };
