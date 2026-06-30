/**
 * Puerto — contrato de persistencia para la entidad Regla de Precio.
 * Separado de ServiceRepositoryPort porque su ciclo de vida y sus consultas
 * son distintos a los del servicio mismo (ver servicios-modelo-persistencia.md).
 *
 * Implementación real: infrastructure/persistence/prisma-price-rule.repository.js
 */
class PriceRuleRepositoryPort {
  /** @returns {Promise<Object[]>} reglas activas e inactivas del servicio */
  async listByService(_serviceId) {
    throw new Error("PriceRuleRepositoryPort.listByService no implementado");
  }

  /** @returns {Promise<Object|null>} */
  async findActiveByTarget(_serviceId, _targetType, _targetId) {
    throw new Error("PriceRuleRepositoryPort.findActiveByTarget no implementado");
  }

  /** @returns {Promise<Object>} */
  async create(_data) {
    throw new Error("PriceRuleRepositoryPort.create no implementado");
  }

  /** @returns {Promise<Object>} */
  async updatePrice(_priceRuleId, _newPrice) {
    throw new Error("PriceRuleRepositoryPort.updatePrice no implementado");
  }
}

module.exports = { PriceRuleRepositoryPort };
