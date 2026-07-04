const { sendWhatsAppMessage } = require("../../../../services/whatsapp-api.service");
const { ChannelProviderPort } = require("../../application/ports/channel-provider.port");

/**
 * Único punto del proyecto que invoca sendWhatsAppMessage — nadie fuera de
 * contexts/communication/infrastructure/ puede hacerlo (criterio de cierre
 * del entregable). Las credenciales siguen resolviéndose dentro de
 * whatsapp-api.service.js vía variables de entorno (Decisión 2, diferida).
 */
class WhatsAppChannelProvider extends ChannelProviderPort {
  async send(channelType, to, content) {
    if (channelType !== "whatsapp") {
      throw new Error(`WhatsAppChannelProvider no soporta el tipo de canal "${channelType}".`);
    }
    const result = await sendWhatsAppMessage(to, content);
    return result !== null;
  }
}

module.exports = { WhatsAppChannelProvider };
