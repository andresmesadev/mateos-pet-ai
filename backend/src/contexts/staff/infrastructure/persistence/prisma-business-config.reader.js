const { BusinessConfigReaderPort } = require("../../application/ports/business-config-reader.port");
const businessConfig = require("../../../../services/business-config.service");

/**
 * Entregable 4.3 (Fase 4) — Configuración por Establecimiento: reemplaza los
 * valores hardcodeados (módulos siempre activos, split siempre 0.5) por la
 * configuración real persistida en Tenant, vía business-config.service.js
 * (fuente única compartida con el equivalente en contexts/services). El
 * puerto y los casos de uso que lo consumen no cambiaron.
 */
class PrismaBusinessConfigReader extends BusinessConfigReaderPort {
  async getActiveModules(tenantId) {
    return businessConfig.getActiveModules(tenantId);
  }

  async getCommissionSplitRate(tenantId, categoryId) {
    return businessConfig.getCommissionSplitRate(tenantId, categoryId);
  }
}

module.exports = { PrismaBusinessConfigReader };
