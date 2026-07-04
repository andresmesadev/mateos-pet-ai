/**
 * El puerto que la regla transversal protege: ningún caso de uso ni
 * productor lo implementa ni lo invoca directamente — solo la
 * infraestructura de Comunicación (Etapa 3, sección 3 y su precisión).
 */
class ChannelProviderPort {
  /**
   * @param {string} channelType — "whatsapp" | "email" | "sms"... (nunca un proveedor concreto)
   * @param {string} to
   * @param {string} content
   * @returns {Promise<boolean>} éxito o fracaso del envío
   */
  async send(_channelType, _to, _content) {
    throw new Error("ChannelProviderPort.send no implementado");
  }
}

module.exports = { ChannelProviderPort };
