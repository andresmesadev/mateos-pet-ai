/**
 * Puerto mínimo de verificación de existencia (servicios-esquema-fisico.md,
 * sección 2: "Servicios no debe conocer Clientes ni Mascotas directamente").
 *
 * Expone solo lo estrictamente necesario para que ChangeServicePriceUseCase
 * valide un destino y ResolveServicePriceUseCase obtenga raza/tamaño de una
 * mascota — nunca la estructura completa de esos contextos.
 *
 * Implementación real: infrastructure/persistence/prisma-target-existence.reader.js
 */
class TargetExistenceReaderPort {
  /** @returns {Promise<boolean>} */
  async clientExists(_clientId, _tenantId) {
    throw new Error("TargetExistenceReaderPort.clientExists no implementado");
  }

  /** @returns {Promise<boolean>} */
  async petExists(_petId, _tenantId) {
    throw new Error("TargetExistenceReaderPort.petExists no implementado");
  }

  /** @returns {Promise<{ breedId: string|null, size: string|null }|null>} */
  async getPetAttributes(_petId, _tenantId) {
    throw new Error("TargetExistenceReaderPort.getPetAttributes no implementado");
  }
}

module.exports = { TargetExistenceReaderPort };
