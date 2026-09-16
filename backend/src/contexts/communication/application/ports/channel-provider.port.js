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

  /**
   * Mejora post-Fase 8 (2026-09-08): plantilla pre-aprobada de Meta — único
   * mecanismo permitido para que el negocio inicie contacto fuera de la
   * ventana de 24h de mensajería libre.
   * @param {string} _channelType
   * @param {string} _to
   * @param {string} _templateName — nombre exacto registrado en Meta
   * @param {string} _languageCode — código de idioma exacto registrado en Meta (ej. "es")
   * @param {Array} _components — parámetros de la plantilla (ver Cloud API docs)
   * @returns {Promise<boolean>}
   */
  async sendTemplate(_channelType, _to, _templateName, _languageCode, _components) {
    throw new Error("ChannelProviderPort.sendTemplate no implementado");
  }
}

module.exports = { ChannelProviderPort };
