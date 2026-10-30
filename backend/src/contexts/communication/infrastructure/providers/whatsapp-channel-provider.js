const { sendWhatsAppMessage, sendWhatsAppTemplateMessage } = require("../../../../services/whatsapp-api.service");
const { ChannelProviderPort } = require("../../application/ports/channel-provider.port");
const { assertWhatsAppRoute } = require('./whatsapp-route-guard');

/**
 * Único punto del proyecto que invoca sendWhatsAppMessage — nadie fuera de
 * contexts/communication/infrastructure/ puede hacerlo (criterio de cierre
 * del entregable). HN-04 resuelve las credenciales cifradas por Tenant y
 * comprueba canal/línea/revisión antes de cada entrega. La ruta heredada
 * por entorno solo se admite para el único Tenant asociado a esa línea.
 */
class WhatsAppChannelProvider extends ChannelProviderPort {
  async send(channelType, to, content, route) {
    if (channelType !== "whatsapp") {
      throw new Error(`WhatsAppChannelProvider no soporta el tipo de canal "${channelType}".`);
    }
    const credentials = await assertWhatsAppRoute(route);
    const result = await sendWhatsAppMessage(to, content, credentials);
    return result ? { messageId: result.messages?.[0]?.id || null } : false;
  }

  // Mejora post-Fase 8 (2026-09-08).
  async sendTemplate(channelType, to, templateName, languageCode, components, route) {
    if (channelType !== "whatsapp") {
      throw new Error(`WhatsAppChannelProvider no soporta el tipo de canal "${channelType}".`);
    }
    const credentials = await assertWhatsAppRoute(route);
    const result = await sendWhatsAppTemplateMessage(to, templateName, languageCode, components, credentials);
    return Boolean(result);
  }
}

module.exports = { WhatsAppChannelProvider };
