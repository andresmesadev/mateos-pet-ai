/**
 * resolveTenant middleware
 *
 * Reads from request headers (set only by trusted Next.js server):
 *   X-Internal-Token     — must match process.env.INTERNAL_API_SECRET
 *   X-Tenant-Id          — tenant ID resolved server-side from session
 *   X-Super-Admin        — "true" if user is super admin
 *   X-View-All-Tenants   — "true" if a non-impersonating super admin
 *                          explicitly requests a cross-tenant view
 *
 * Sets req.tenant = { isSuperAdmin: boolean, tenantId: string | null, viewAllTenants: boolean }
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
 *
 * Entregable 6.6 (Fase 6) — Operación Centralizada, Fase B (saneamiento):
 * un super admin sin `tenantId` (sin impersonar) ya no obtiene una vista
 * cross-tenant implícita. Debe declarar la intención explícitamente vía
 * `X-View-All-Tenants: true`; sin ese flag, la request se rechaza con 403.
 * Esto cierra, en un único choke point, el patrón `tenantId ? {...} : {}`
 * detectado en la auditoría de 6.6 en 6+ contextos (Finanzas, Staff,
 * Automatizaciones, Empleados Digitales, Comunicación, Eventos) sin
 * necesidad de modificar cada repositorio individualmente — los repos
 * conservan su comportamiento exacto; lo que cambia es si la request
 * llega a ellos con `tenantId: null` de forma deliberada o no.
 */
const prisma = require("../lib/prisma");
const logger = require("../lib/logger");

async function resolveTenant(req, res, next) {
  // Single-tenant mode: always use the configured tenant
  const singleTenantId = process.env.SINGLE_TENANT_ID;
  if (singleTenantId) {
    req.tenant = { isSuperAdmin: false, tenantId: singleTenantId, viewAllTenants: false };
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
  const tenantId = req.headers["x-tenant-id"] || null;
  const viewAllTenantsRequested = req.headers["x-view-all-tenants"] === "true";

  if (!isSuperAdmin && !tenantId) {
    return res.status(403).json({ error: "Forbidden: no tenant assigned" });
  }

  if (isSuperAdmin && !tenantId && !viewAllTenantsRequested) {
    return res.status(403).json({
      error:
        "Forbidden: especifique un establecimiento (X-Tenant-Id) o solicite explícitamente la vista de todos los establecimientos (X-View-All-Tenants).",
    });
  }

  const viewAllTenants = Boolean(isSuperAdmin && !tenantId && viewAllTenantsRequested);
  if (viewAllTenants) {
    logger.info("[Auth] Super admin solicitó vista cross-tenant explícita (X-View-All-Tenants)", {
      path: req.originalUrl,
    });
  }

  req.tenant = { isSuperAdmin, tenantId, viewAllTenants };
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
