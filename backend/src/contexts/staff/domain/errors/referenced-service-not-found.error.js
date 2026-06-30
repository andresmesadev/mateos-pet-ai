const { DomainError } = require("./domain-error");

class ReferencedServiceNotFoundError extends DomainError {
  constructor(serviceId) {
    super("REFERENCED_SERVICE_NOT_FOUND", `El servicio "${serviceId}" referenciado no existe.`);
    this.serviceId = serviceId;
  }
}

module.exports = { ReferencedServiceNotFoundError };
