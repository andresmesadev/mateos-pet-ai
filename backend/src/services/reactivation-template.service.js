// Mejora post-Fase 8 (2026-09-08): plantilla pre-aprobada de Meta para
// reabrir la ventana de 24h con clientes inactivos ("Reactivar" en el
// dashboard, componentes/dashboard/reactivation-campaign.tsx, hoy manda
// texto libre y falla en silencio con clientes de más de 24h sin escribir).
//
// Nombre e idioma NO están hardcodeados a propósito: la plantilla todavía
// está en aprobación en Meta Business Suite al momento de escribir esto.
// Se leen de env — conectar la plantilla aprobada es poner
// WHATSAPP_TEMPLATE_REACTIVACION_NAME / _LANG en el .env, sin tocar código.
// Mientras no estén configuradas, isReactivationTemplateConfigured() es
// false y el llamador decide el fallback (hoy: ninguno la invoca todavía —
// deliberado, ver el commit de este cambio).
const { sendTemplateMessage } = require("../contexts/communication");
const logger = require("../lib/logger");

const isReactivationTemplateConfigured = () => {
  return Boolean(
    String(process.env.WHATSAPP_TEMPLATE_REACTIVACION_NAME || "").trim() &&
    String(process.env.WHATSAPP_TEMPLATE_REACTIVACION_LANG || "").trim()
  );
};

/**
 * @param {{ tenantId?: string|null, userId: string, phone: string, clientName?: string|null, conversationId?: string|null }} client
 * @returns {Promise<boolean>}
 */
const sendReactivationTemplate = async ({ tenantId, userId, phone, clientName, conversationId } = {}) => {
  const templateName = String(process.env.WHATSAPP_TEMPLATE_REACTIVACION_NAME || "").trim();
  const languageCode = String(process.env.WHATSAPP_TEMPLATE_REACTIVACION_LANG || "").trim();

  if (!templateName || !languageCode) {
    logger.error(
      "[ReactivationTemplate] WHATSAPP_TEMPLATE_REACTIVACION_NAME/_LANG no configuradas — plantilla aún no aprobada en Meta"
    );
    return false;
  }

  const name = String(clientName || "").trim() || "cliente";
  const renderedContent = `Hola ${name} 👋 Somos Mateos Pet. Hace tiempo no vemos a tu mascota por acá y queríamos saludarte. Si quieres agendar una cita o tienes alguna pregunta, escríbenos por aquí 🐾`;

  try {
    await sendTemplateMessage({
      tenantId: tenantId ?? null,
      userId,
      phone,
      conversationId: conversationId ?? null,
      origin: "sistema",
      content: renderedContent,
      templateName,
      languageCode,
      components: [
        { type: "body", parameters: [{ type: "text", text: name }] },
      ],
    });
    logger.info("[ReactivationTemplate] Plantilla de reactivación enviada:", phone);
    return true;
  } catch (error) {
    logger.error("[ReactivationTemplate] Error enviando plantilla de reactivación:", phone, error.message);
    return false;
  }
};

module.exports = {
  isReactivationTemplateConfigured,
  sendReactivationTemplate,
};
