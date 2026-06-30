const { DomainError } = require("./domain-error");

class DuplicateServiceNameError extends DomainError {
  constructor(name, categoryId) {
    super(
      "DUPLICATE_SERVICE_NAME",
      `Ya existe un servicio activo llamado "${name}" en esta categoría.`
    );
    this.serviceName = name;
    this.categoryId = categoryId;
  }
}

module.exports = { DuplicateServiceNameError };
