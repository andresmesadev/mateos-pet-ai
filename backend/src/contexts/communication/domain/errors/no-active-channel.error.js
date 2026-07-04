const { DomainError } = require("./domain-error");

// Precondición de "Enviar Mensaje": debe existir un Canal activo resoluble.
class NoActiveChannelError extends DomainError {
  constructor(tenantId) {
    super(`No hay ningún Canal activo disponible${tenantId ? ` para el tenant "${tenantId}"` : ""}.`);
  }
}

module.exports = { NoActiveChannelError };
