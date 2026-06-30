const { DomainError } = require("./domain-error");

class ServiceNotFoundError extends DomainError {
  constructor(serviceId) {
    super("SERVICE_NOT_FOUND", `No existe un servicio con id "${serviceId}".`);
    this.serviceId = serviceId;
  }
}

module.exports = { ServiceNotFoundError };
