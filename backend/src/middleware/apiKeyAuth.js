/**
 * apiKeyAuth middleware — API pública, Fase 1 (Ecosistema).
 *
 * Resuelve el tenantId exclusivamente desde una API key válida y no
 * revocada — nunca desde el body/params de la request (mismo criterio de
 * aislamiento que resolveTenant.js, adaptado a un consumidor externo en
 * vez de la sesión del dashboard).
 *
 * Lee la key de "Authorization: Bearer <key>" o, si no está presente, del
 * header "X-Api-Key". Sin ninguno de los dos, o con una key inválida o
 * revocada, rechaza con 401.
 *
 * Sin catálogo de recursos propio todavía — este middleware no está
 * montado en ninguna ruta de producción en este entregable; construye el
 * mecanismo de identidad para cuando exista un primer recurso que lo use.
 */
const prisma = require("../lib/prisma");
const logger = require("../lib/logger");
const { hashApiKey } = require("../lib/apiKeyHash");

function extractRawKey(req) {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  const apiKeyHeader = req.headers["x-api-key"];
  if (apiKeyHeader) return String(apiKeyHeader).trim();
  return null;
}

async function apiKeyAuth(req, res, next) {
  const rawKey = extractRawKey(req);
  if (!rawKey) {
    return res.status(401).json({ error: "API key requerida" });
  }

  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });

  if (!apiKey || apiKey.revokedAt) {
    logger.info("[ApiKeyAuth] Rechazado — key inválida o revocada", { path: req.originalUrl });
    return res.status(401).json({ error: "API key inválida o revocada" });
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });
  logger.info("[ApiKeyAuth] Autenticación exitosa", { tenantId: apiKey.tenantId, path: req.originalUrl });

  req.apiKey = { tenantId: apiKey.tenantId, scopes: apiKey.scopes };
  return next();
}

module.exports = { apiKeyAuth };
