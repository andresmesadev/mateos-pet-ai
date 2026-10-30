const express = require('express');
const prisma = require('../lib/prisma');
const { resolveTenant } = require('../middleware/resolveTenant');
const { staffAccessRole } = require('../contexts/staff/domain/rules/staff-access.rules');
const { buildWhatsAppConnections } = require('../services/whatsapp-connections.service');
const ai = require('../services/ai-quota.service');
const router = express.Router();
const fail = (code, status) => Object.assign(new Error(code), { code, status });

router.use(async (req, res, next) => {
  if (req.headers['x-super-admin'] === 'true' && !req.headers['x-staff-id']) {
    const tenantId = req.headers['x-tenant-id'];
    if (typeof tenantId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(tenantId)) return res.status(403).json({ code: 'TENANT_REQUIRED' });
    try {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { active: true } });
      if (!tenant?.active) return res.status(402).json({ code: 'TENANT_NOT_ENABLED' });
      req.tenant = { tenantId, isSuperAdmin: true, viewAllTenants: false };
      req.actor = { type: 'admin', email: req.headers['x-admin-email'] || 'platform-administrator' };
      return next();
    } catch { return res.status(503).json({ code: 'ACCESS_UNAVAILABLE' }); }
  }
  return resolveTenant(req, res, next);
});
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!req.tenant?.tenantId || req.actor?.type !== 'admin') return res.status(403).json({ code: 'ADMINISTRATOR_REQUIRED' });
  return next();
});
const actorKey = req => JSON.stringify([req.tenant.tenantId, req.headers['x-staff-id'] || req.actor.email, req.headers['x-staff-session-version'] || 'global']);
function connections(req) {
  return buildWhatsAppConnections({ authorize: async (tx, tenantId) => {
    if (req.tenant.isSuperAdmin && !req.headers['x-staff-id']) return;
    const staffId = req.headers['x-staff-id'], version = Number(req.headers['x-staff-session-version']);
    if (typeof staffId !== 'string' || !Number.isSafeInteger(version) || version < 1) throw fail('ADMINISTRATOR_REQUIRED', 403);
    if (tx !== prisma) {
      await tx.$queryRaw`SELECT id FROM "Staff" WHERE id=${staffId} FOR SHARE`;
      await tx.$queryRaw`SELECT "staffId" FROM "StaffCredential" WHERE "staffId"=${staffId} FOR SHARE`;
    }
    const credential = await tx.staffCredential.findFirst({ where: { staffId, active: true, sessionVersion: version, staff: { tenantId, active: true } }, select: { staff: { select: { role: true, accessPermissions: true } } } });
    if (!credential || staffAccessRole(credential.staff) !== 'admin') throw fail('ADMINISTRATOR_REQUIRED', 403);
  } });
}
const handle = fn => async (req, res) => {
  try { return res.json(await fn(req)); }
  catch (error) {
    const known = Number.isInteger(error.status) && error.status >= 400 && error.status <= 503;
    return res.status(known ? error.status : 503).json({ code: known ? error.code : 'INTEGRATION_UNAVAILABLE', error: 'No se pudo completar la operación de integración. Revisa el estado antes de repetir.' });
  }
};
router.get('/status', handle(async req => ({ whatsapp: await connections(req).status(req.tenant.tenantId), ai: await ai.status(req.tenant.tenantId), platformAdministrator: req.tenant.isSuperAdmin && !req.headers['x-staff-id'] })));
router.post('/whatsapp/start', handle(req => connections(req).start({ tenantId: req.tenant.tenantId, actorKey: actorKey(req) })));
router.post('/whatsapp/complete', handle(req => connections(req).complete({ tenantId: req.tenant.tenantId, actorKey: actorKey(req), state: req.body?.state, code: req.body?.code, wabaId: req.body?.wabaId, phoneNumberId: req.body?.phoneNumberId })));
router.post('/whatsapp/disconnect', handle(req => connections(req).disconnect({ tenantId: req.tenant.tenantId, expectedVersion: req.body?.expectedVersion, actorKey: actorKey(req) })));
const technical = req => { if (!req.tenant.isSuperAdmin || req.headers['x-staff-id']) throw fail('PLATFORM_ADMINISTRATOR_REQUIRED', 403); };
router.post('/ai/limit', handle(req => { technical(req); return ai.setLimit({ tenantId: req.tenant.tenantId, monthlyLimit: req.body?.monthlyLimit, actorKey: actorKey(req) }); }));
router.post('/ai/reconcile', handle(req => { technical(req); return ai.reconcile({ tenantId: req.tenant.tenantId, entryId: req.body?.entryId, accepted: req.body?.accepted, receiptRef: req.body?.receiptRef, actorKey: actorKey(req) }); }));
module.exports = router;
