const { parseIncomingMessage } = require("../../../../services/whatsapp.service");
const { getTenantByPhone } = require("../../../../services/tenant.service");
const logger = require("../../../../lib/logger");

/**
 * Resuelve el tenantId ANTES de invocar el motor conversacional, reutilizando
 * dos funciones ya exportadas por el propio motor y por Negocio (tenant.service) —
 * sin duplicar su lógica, solo reusándola (Etapa 3 no especificó cómo se
 * obtiene tenantId antes de delegar en el motor; el motor lo resuelve
 * internamente para su propio uso, de forma redundante pero inocua — ver
 * hallazgo del Completion Report).
 */
async function resolveTenantId(body) {
  const parsed = parseIncomingMessage(body);
  if (!parsed?.phoneNumberId) return null;

  try {
    const tenant = await getTenantByPhone(parsed.phoneNumberId);
    return tenant?.active ? tenant.id : null;
  } catch (error) {
    logger.error("[Recepcionista IA] Error resolviendo tenant:", error.message);
    return null;
  }
}

module.exports = { resolveTenantId };
