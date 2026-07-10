/**
 * resolveTenant middleware
 *
 * Reads from request headers (set only by trusted Next.js server):
 *   X-Internal-Token  — must match process.env.INTERNAL_API_SECRET
 *   X-Tenant-Id       — tenant ID resolved server-side from session
 *   X-Super-Admin     — "true" if user is super admin
 *
 * Sets req.tenant = { isSuperAdmin: boolean, tenantId: string | null }
 *
 * Special modes:
 *   SINGLE_TENANT_ID env  → always use that tenantId, skip token check
 *   NODE_ENV=test         → skip token check, read headers directly
 *
 * Entregable 4.4 (Fase 4) — Facturación / Habilitación Comercial: rechaza
 * el acceso si el tenant resuelto tiene `active === false`, unificando el
 * comportamiento comercial con el canal de WhatsApp (que ya respeta este
 * mismo campo desde el Entregable 4.1, resolve-tenant-id.js en Recepcionista
 * IA). Sin período de gracia, sin superAdmin exento del propio dato del
 * tenant que se está consultando.
 */
const prisma = require("../lib/prisma");

async function resolveTenant(req, res, next) {
  // Single-tenant mode: always use the configured tenant
  const singleTenantId = process.env.SINGLE_TENANT_ID;
  if (singleTenantId) {
    req.tenant = { isSuperAdmin: false, tenantId: singleTenantId };
    return checkActiveAndContinue(req, res, next);
  }

  const isTest = process.env.NODE_ENV === "test";
  const secret = process.env.INTERNAL_API_SECRET;

  // In non-test mode with a secret configured, validate the token
  if (!isTest && secret) {
    const token = req.headers["x-internal-token"];
    if (!token || token !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const isSuperAdmin = req.headers["x-super-admin"] === "true";
  const tenantId = req.headers["x-tenant-id"] ?? null;

  if (!isSuperAdmin && !tenantId) {
    return res.status(403).json({ error: "Forbidden: no tenant assigned" });
  }

  req.tenant = { isSuperAdmin, tenantId: tenantId || null };
  return checkActiveAndContinue(req, res, next);
}

/**
 * Un superAdmin sin tenantId (operando sin impersonar a ninguno) no tiene
 * ningún Tenant que verificar — pasa sin gate. Un superAdmin que sí trae
 * tenantId (impersonando/consultando un establecimiento específico) queda
 * sujeto a la misma suspensión que cualquier otro acceso a ese tenant.
 */
async function checkActiveAndContinue(req, res, next) {
  const { tenantId } = req.tenant;
  if (!tenantId) return next();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { active: true },
  });

  if (tenant && tenant.active === false) {
    return res.status(402).json({ error: "Suscripción inactiva — acceso suspendido" });
  }

  return next();
}

module.exports = { resolveTenant };
