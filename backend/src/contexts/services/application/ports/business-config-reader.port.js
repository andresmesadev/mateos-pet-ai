/**
 * Puerto — lectura de configuración del establecimiento (contexto Negocio).
 * Solo lectura: Servicios no modifica configuración de Negocio.
 *
 * Implementación real: infrastructure/persistence/prisma-business-config.reader.js
 */
class BusinessConfigReaderPort {
  /** @returns {Promise<string[]>} módulos activos del establecimiento */
  async getActiveModules(_tenantId) {
    throw new Error("BusinessConfigReaderPort.getActiveModules no implementado");
  }
}

module.exports = { BusinessConfigReaderPort };
