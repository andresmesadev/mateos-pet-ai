const { DomainError } = require("./domain-error");

class StaffNotFoundError extends DomainError {
  constructor(staffId) {
    super("STAFF_NOT_FOUND", `No existe un miembro del staff con id "${staffId}".`);
    this.staffId = staffId;
  }
}

module.exports = { StaffNotFoundError };
