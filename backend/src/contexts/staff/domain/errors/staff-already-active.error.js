const { DomainError } = require("./domain-error");

class StaffAlreadyActiveError extends DomainError {
  constructor(staffId) {
    super("STAFF_ALREADY_ACTIVE", `El miembro del staff "${staffId}" ya está activo.`);
    this.staffId = staffId;
  }
}

module.exports = { StaffAlreadyActiveError };
