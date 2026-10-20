/**
 * Puerto propio de Staff hacia Servicios — solo la categoría de un servicio,
 * para calcular comisión en RecordCommissionOnAppointmentCompletedUseCase.
 */
class ServiceCategoryReaderPort {
  /** Indicador efectivo del servicio (override individual o regla histórica de categoría). Lectura tenant-scoped en ctx. @returns {Promise<{ id: string, name: string, appliesCommissionSplit: boolean }|null>} */
  async getCategoryForService(_serviceId, _tenantId, _ctx) {
    throw new Error("ServiceCategoryReaderPort.getCategoryForService no implementado");
  }
}

module.exports = { ServiceCategoryReaderPort };
