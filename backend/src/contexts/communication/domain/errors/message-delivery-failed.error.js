const { DomainError } = require("./domain-error");

// Todo-o-nada (Etapa 3): si el proveedor falla, Enviar Mensaje no persiste nada.
class MessageDeliveryFailedError extends DomainError {
  constructor(reason) {
    super(`No se pudo entregar el mensaje: ${reason}`);
  }
}

module.exports = { MessageDeliveryFailedError };
