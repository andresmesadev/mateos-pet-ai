const { BusinessConfigReaderPort } = require("../../application/ports/business-config-reader.port");
const businessConfig = require("../../../../services/business-config.service");

/**
 * Entregable 4.3 (Fase 4) — Configuración por Establecimiento: reemplaza el
 * valor hardcodeado ("grooming", "veterinary" para todo tenant) por la
 * configuración real persistida en Tenant, vía business-config.service.js
 * (fuente única compartida con el equivalente en contexts/staff). El puerto
 * y los casos de uso que lo consumen no cambiaron.
 */
class PrismaBusinessConfigReader extends BusinessConfigReaderPort {
  async getActiveModules(tenantId) {
    return businessConfig.getActiveModules(tenantId);
  }
}

module.exports = { PrismaBusinessConfigReader };
