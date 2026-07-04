const { DomainError } = require("./domain-error");

class InvalidDigitalEmployeeAttributesError extends DomainError {
  constructor(reason) { super(reason); }
}
class DigitalEmployeeNotFoundError extends DomainError {
  constructor(id) { super(`El Empleado Digital "${id}" no existe.`); }
}
class DigitalEmployeeNotActiveError extends DomainError {
  constructor(id) { super(`El Empleado Digital "${id}" no está activo; no puede iniciar una tarea.`); }
}
class DigitalEmployeeAlreadyPausedError extends DomainError {
  constructor(id) { super(`El Empleado Digital "${id}" ya está pausado.`); }
}
class DigitalEmployeeAlreadyActiveError extends DomainError {
  constructor(id) { super(`El Empleado Digital "${id}" ya está activo.`); }
}

module.exports = {
  InvalidDigitalEmployeeAttributesError,
  DigitalEmployeeNotFoundError,
  DigitalEmployeeNotActiveError,
  DigitalEmployeeAlreadyPausedError,
  DigitalEmployeeAlreadyActiveError,
};
