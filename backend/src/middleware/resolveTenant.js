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
 */

function resolveTenant(req, res, next) {
  // Single-tenant mode: always use the configured tenant
  const singleTenantId = process.env.SINGLE_TENANT_ID;
  if (singleTenantId) {
    req.tenant = { isSuperAdmin: false, tenantId: singleTenantId };
    return next();
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
  return next();
}

module.exports = { resolveTenant };
