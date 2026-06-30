/**
 * Puerto — lectura de Categoría de Servicio. Separado de ServiceRepositoryPort
 * porque Categoría de Servicio es un agregado independiente del agregado
 * Servicio (servicios-modelo-persistencia.md, sección 5): Servicio la
 * referencia por identificador, no la contiene ni la gestiona.
 *
 * Implementación real: infrastructure/persistence/prisma-service-category.reader.js
 */
class ServiceCategoryReaderPort {
  /** @returns {Promise<{ id: string, name: string, appliesCommissionSplit: boolean, active: boolean }|null>} */
  async findById(_categoryId) {
    throw new Error("ServiceCategoryReaderPort.findById no implementado");
  }
}

module.exports = { ServiceCategoryReaderPort };
