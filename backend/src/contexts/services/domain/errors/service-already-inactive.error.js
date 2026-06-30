const { DomainError } = require("./domain-error");

class ServiceAlreadyInactiveError extends DomainError {
  constructor(serviceId) {
    super("SERVICE_ALREADY_INACTIVE", `El servicio "${serviceId}" ya está inactivo.`);
    this.serviceId = serviceId;
  }
}

module.exports = { ServiceAlreadyInactiveError };
