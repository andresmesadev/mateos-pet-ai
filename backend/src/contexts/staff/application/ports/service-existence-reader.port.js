/**
 * Puerto mínimo hacia Servicios — solo existencia de un serviceId.
 * Usado por ManageStaffCapabilitiesUseCase y RecordCommissionOnAppointmentCompletedUseCase.
 */
class ServiceExistenceReaderPort {
  async exists(_serviceId) {
    throw new Error("ServiceExistenceReaderPort.exists no implementado");
  }
}

module.exports = { ServiceExistenceReaderPort };
