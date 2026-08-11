/**
 * requireInternalToken — cierre de la deuda A5 (Auditoría v2.1.0) en
 * /api/billing/* (excepto /api/billing/webhook, ya protegido por firma
 * Stripe). El proxy Next.js (app/api/proxy/billing/route.ts) ya enviaba
 * X-Internal-Token en cada request — el backend nunca lo validaba, dejando
 * cancel/change-plan/status alcanzables con cualquier tenantId adivinado.
 * Mismo criterio de validación que resolveTenant.js: en NODE_ENV=test o
 * sin INTERNAL_API_SECRET configurado, no bloquea (paridad con el resto
 * del proyecto).
 */
function requireInternalToken(req, res, next) {
  const isTest = process.env.NODE_ENV === "test";
  const secret = process.env.INTERNAL_API_SECRET;

  if (!isTest && secret) {
    const token = req.headers["x-internal-token"];
    if (!token || token !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  return next();
}

module.exports = { requireInternalToken };
