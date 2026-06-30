/**
 * Puerto propio de Staff hacia Servicios — solo la categoría de un servicio,
 * para calcular comisión en RecordCommissionOnAppointmentCompletedUseCase.
 */
class ServiceCategoryReaderPort {
  /** @returns {Promise<{ id: string, name: string, appliesCommissionSplit: boolean }|null>} */
  async getCategoryForService(_serviceId) {
    throw new Error("ServiceCategoryReaderPort.getCategoryForService no implementado");
  }
}

module.exports = { ServiceCategoryReaderPort };
