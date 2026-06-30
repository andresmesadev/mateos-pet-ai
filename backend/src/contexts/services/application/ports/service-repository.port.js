/**
 * Puerto — contrato que debe cumplir cualquier implementación de persistencia
 * para la entidad Servicio. La capa de aplicación depende de esta forma,
 * nunca de Prisma directamente (Principio Permanente 1 de la arquitectura
 * de aplicación: "los casos de uso conocen capacidades del dominio, no
 * mecanismos de persistencia").
 *
 * Implementación real: infrastructure/persistence/prisma-service.repository.js
 */
class ServiceRepositoryPort {
  /** @returns {Promise<Object|null>} */
  async findById(_serviceId) {
    throw new Error("ServiceRepositoryPort.findById no implementado");
  }

  /** @returns {Promise<Object|null>} */
  async findActiveByNameAndCategory(_tenantId, _categoryId, _name) {
    throw new Error("ServiceRepositoryPort.findActiveByNameAndCategory no implementado");
  }

  /** @returns {Promise<Object>} */
  async create(_data) {
    throw new Error("ServiceRepositoryPort.create no implementado");
  }

  /** @returns {Promise<Object>} */
  async update(_serviceId, _data) {
    throw new Error("ServiceRepositoryPort.update no implementado");
  }

  /** @returns {Promise<Object[]>} */
  async listAvailable(_filter) {
    throw new Error("ServiceRepositoryPort.listAvailable no implementado");
  }
}

module.exports = { ServiceRepositoryPort };
