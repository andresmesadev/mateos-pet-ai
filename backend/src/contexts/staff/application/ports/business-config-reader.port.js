class BusinessConfigReaderPort {
  /** @returns {Promise<string[]>} módulos activos del establecimiento */
  async getActiveModules(_tenantId) {
    throw new Error("BusinessConfigReaderPort.getActiveModules no implementado");
  }
  /** @returns {Promise<number>} tasa de split configurada para una categoría que aplica split */
  async getCommissionSplitRate(_tenantId, _categoryId) {
    throw new Error("BusinessConfigReaderPort.getCommissionSplitRate no implementado");
  }
}

module.exports = { BusinessConfigReaderPort };
