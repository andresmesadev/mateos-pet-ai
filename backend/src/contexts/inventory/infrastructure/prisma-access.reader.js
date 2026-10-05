const { effectiveAccess } = require('../../../services/dashboard-access.service');
const { fail } = require('../domain/policy');
const { db } = require('./prisma-inventory.repository');
class PrismaInventoryAccessReader {
  async readAccess({ tenantId, actor }, ctx) {
    if (!tenantId || !actor || !actor.type) fail('ACCESS_DENIED', 'Selecciona un establecimiento e inicia sesión.', 403);
    const tenant = await db(ctx).tenant.findUnique({ where: { id: tenantId }, select: { active: true, activeModules: true } });
    if (!tenant?.active) fail('ACCESS_DENIED', 'Establecimiento no disponible.', 403);
    let current, principalKey;
    if (actor.staffId) {
      if (!Number.isInteger(actor.sessionVersion) || actor.sessionVersion < 1) fail('ACCESS_DENIED', 'La sesión del equipo ya no está disponible.', 403);
      const credential = await db(ctx).staffCredential.findFirst({ where: { staffId: actor.staffId, sessionVersion: actor.sessionVersion, active: true, staff: { tenantId, active: true } }, include: { staff: true } });
      if (!credential) fail('ACCESS_DENIED', 'La sesión del equipo ya no está disponible.', 403);
      current = { type: credential.staff.role, staffId: actor.staffId, name: credential.staff.name, accessPermissions: credential.staff.accessPermissions };
      principalKey = 'staff:' + actor.staffId;
    } else {
      if (actor.type !== 'admin' || !actor.email) fail('ACCESS_DENIED', 'Falta la identidad administrativa autenticada.', 403);
      principalKey = 'admin:' + actor.email.trim().normalize('NFC').toLowerCase();
      current = { type: 'admin', name: actor.name || 'Administrador', email: actor.email };
    }
    const access = effectiveAccess(current, tenant.activeModules);
    if (!access.navigation.length) fail('ACCESS_DENIED', 'Perfil no permitido.', 403);
    return { ...access, principalKey, snapshot: { actorId: principalKey, actorName: current.name, actorRole: current.type } };
  }
}
module.exports = { PrismaInventoryAccessReader };
