const { ServiceDeletionBlockedError } = require("../../domain/errors/service-deletion-blocked.error");

function createDeleteRetiredServiceUseCase({ serviceRepository }) {
  return async function execute({ tenantId, serviceId, confirmName }) {
    if (!tenantId) throw new ServiceDeletionBlockedError("Selecciona un establecimiento antes de eliminar.");
    if (typeof confirmName !== "string" || !confirmName.trim()) {
      throw new ServiceDeletionBlockedError("Escribe el nombre del servicio para confirmar la eliminación.");
    }
    return serviceRepository.deleteRetiredIfUnused({ tenantId, serviceId, confirmName });
  };
}
module.exports = { createDeleteRetiredServiceUseCase };
