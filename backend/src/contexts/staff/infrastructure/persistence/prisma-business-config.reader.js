const { BusinessConfigReaderPort } = require("../../application/ports/business-config-reader.port");

/**
 * Implementación provisional — mismo estado que su equivalente en
 * contexts/services (el contexto Negocio todavía no persiste módulos ni
 * tasas de split configurables). getCommissionSplitRate replica el valor
 * ya hardcodeado en Fase 1 (GROOMING_SPLIT_RATE = 0.5,
 * el commission.service.js de Fase 1 (retirado en el Entregable Puente)) hasta que Negocio lo persista
 * realmente — esa migración no toca el puerto ni los casos de uso que lo
 * consumen, solo esta clase.
 */
class PrismaBusinessConfigReader extends BusinessConfigReaderPort {
  async getActiveModules(_tenantId) {
    return ["grooming", "veterinary"];
  }

  async getCommissionSplitRate(_tenantId, _categoryId) {
    return 0.5;
  }
}

module.exports = { PrismaBusinessConfigReader };
