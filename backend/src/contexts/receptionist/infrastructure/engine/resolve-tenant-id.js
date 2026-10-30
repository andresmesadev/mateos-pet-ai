const { parseIncomingMessage } = require("../../../../services/whatsapp.service");
const { receiver } = require('../../../../services/whatsapp-route.service');
const logger = require("../../../../lib/logger");
const { isWhatsAppEnabled } = require('../../../../lib/whatsapp-runtime');

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
  if (!isWhatsAppEnabled() || !parsed?.phoneNumberId) return null;

  try {
    const entry = body?.entry?.find(e => e.changes?.some(c => c.value?.metadata?.phone_number_id === parsed.phoneNumberId));
    const route = await receiver(parsed.phoneNumberId, entry?.id ?? null);
    return route?.tenantId ?? null;
  } catch (error) {
    logger.error("[Recepcionista IA] Error resolviendo tenant:", error.message);
    return null;
  }
}

module.exports = { resolveTenantId };
