const { DomainError } = require("./domain-error");

class InvalidPriceError extends DomainError {
  constructor(value) {
    super("INVALID_PRICE", `El precio "${value}" no es válido: no puede ser nulo ni negativo.`);
    this.value = value;
  }
}

module.exports = { InvalidPriceError };
