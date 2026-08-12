/**
 * clientAuth — Identidad de Cliente (Ecosistema, Portal del Cliente).
 * Resuelve { tenantId, userId } exclusivamente desde un ClientSession
 * válido y no revocado/expirado — nunca desde body/params/query. Middleware
 * separado de apiKeyAuth (que sigue resolviendo la app/tenant vía la
 * ApiKey); ambos se montan juntos en las rutas que los necesiten.
 */
const prisma = require("../lib/prisma");
const logger = require("../lib/logger");
const { hashSecret } = require("../lib/clientAuthCrypto");

function extractRawToken(req) {
  const header = req.headers["x-client-token"];
  return header ? String(header).trim() : null;
}

async function clientAuth(req, res, next) {
  const rawToken = extractRawToken(req);
  if (!rawToken) {
    return res.status(401).json({ error: "Token de cliente requerido" });
  }

  const tokenHash = hashSecret(rawToken);
  const session = await prisma.clientSession.findUnique({ where: { tokenHash } });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    logger.info("[ClientAuth] Rechazado — sesión inválida, revocada o expirada", { path: req.originalUrl });
    return res.status(401).json({ error: "Sesión de cliente inválida o expirada" });
  }

  await prisma.clientSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  req.clientAuth = { tenantId: session.tenantId, userId: session.userId };
  return next();
}

module.exports = { clientAuth };
