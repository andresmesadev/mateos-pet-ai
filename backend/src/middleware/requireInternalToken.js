/**
 * requireInternalToken — cierre de la deuda A5 (Auditoría v2.1.0) en
 * /api/billing/* (excepto /api/billing/webhook, ya protegido por firma
 * Stripe). El proxy Next.js (app/api/proxy/billing/route.ts) ya enviaba
 * X-Internal-Token en cada request — el backend nunca lo validaba, dejando
 * cancel/change-plan/status alcanzables con cualquier tenantId adivinado.
 * Mismo criterio de validación que resolveTenant.js: en NODE_ENV=test no
 * bloquea.
 *
 * Fix post-auditoría de seguridad (2026-09-07, hallazgo F14): antes, si
 * INTERNAL_API_SECRET no estaba configurado, el chequeo se saltaba entero
 * (fail-open) — cualquiera podía cancelar la suscripción de cualquier
 * tenant o leer sus IDs de Stripe. Ahora la ausencia del secreto en un
 * entorno no-test se trata como error de configuración y rechaza cerrado,
 * igual que resolveTenant.js.
 */
const logger = require("../lib/logger");

function requireInternalToken(req, res, next) {
  const isTest = process.env.NODE_ENV === "test";
  const secret = process.env.INTERNAL_API_SECRET;

  if (!isTest) {
    if (!secret) {
      logger.error("[Auth] INTERNAL_API_SECRET no configurado — rechazando por seguridad (fail closed)");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    const token = req.headers["x-internal-token"];
    if (!token || token !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  return next();
}

module.exports = { requireInternalToken };
