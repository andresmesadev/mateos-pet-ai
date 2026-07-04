const { WhatsAppChannelProvider } = require("./whatsapp-channel-provider");
const { ChannelProviderPort } = require("../../application/ports/channel-provider.port");

/**
 * Selección del proveedor concreto — responsabilidad exclusiva de la
 * infraestructura (precisión congelada en la Etapa 3). Los casos de uso solo
 * conocen ChannelProviderPort; este registro es lo único que sabe que
 * "whatsapp" se implementa hoy con WhatsAppChannelProvider.
 */
class ChannelProviderRegistry extends ChannelProviderPort {
  constructor(providersByType) {
    super();
    this.providersByType = providersByType;
  }

  async send(channelType, to, content) {
    const provider = this.providersByType[channelType];
    if (!provider) {
      throw new Error(`No hay proveedor de infraestructura registrado para el tipo de canal "${channelType}".`);
    }
    return provider.send(channelType, to, content);
  }
}

function buildChannelProviderRegistry() {
  return new ChannelProviderRegistry({
    whatsapp: new WhatsAppChannelProvider(),
  });
}

module.exports = { ChannelProviderRegistry, buildChannelProviderRegistry };
