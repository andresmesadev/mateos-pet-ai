const { isCategoryEnabled } = require("../../domain/rules/service-category.rules");

/**
 * ListAvailableServicesUseCase — Consulta.
 * Implementa "Consultar Servicios Disponibles". Operación de lectura pura.
 * Por defecto retorna solo servicios activos.
 *
 * Filtra además por módulos activos del establecimiento: un servicio cuya
 * categoría dejó de estar habilitada por los módulos activos de Negocio no
 * debe aparecer como disponible (contrato funcional, sección 6 —
 * "Qué contextos consume: Negocio, para filtrar categorías habilitadas
 * según los módulos activos del establecimiento").
 *
 * @param {Object} deps
 * @param {import("../ports/service-repository.port").ServiceRepositoryPort} deps.serviceRepository
 * @param {import("../ports/service-category-reader.port").ServiceCategoryReaderPort} deps.serviceCategoryReader
 * @param {import("../ports/business-config-reader.port").BusinessConfigReaderPort} deps.businessConfigReader
 */
function createListAvailableServicesUseCase({ serviceRepository, serviceCategoryReader, businessConfigReader }) {
  return async function execute({ tenantId, categoryId = null, includeInactive = false }) {
    const services = await serviceRepository.listAvailable({ tenantId, categoryId, includeInactive });
    const activeModules = await businessConfigReader.getActiveModules(tenantId);

    const categoryCache = new Map();
    const filtered = [];
    for (const service of services) {
      if (!categoryCache.has(service.categoryId)) {
        categoryCache.set(service.categoryId, await serviceCategoryReader.findById(service.categoryId));
      }
      const category = categoryCache.get(service.categoryId);
      if (category && isCategoryEnabled(category.name, activeModules)) {
        filtered.push(service);
      }
    }

    return { services: filtered };
  };
}

module.exports = { createListAvailableServicesUseCase };
