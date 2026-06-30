const { DomainError } = require("./domain-error");

class ServiceInactiveError extends DomainError {
  constructor(serviceId) {
    super(
      "SERVICE_INACTIVE",
      `No se puede resolver precio sobre el servicio "${serviceId}": está desactivado.`
    );
    this.serviceId = serviceId;
  }
}

module.exports = { ServiceInactiveError };
