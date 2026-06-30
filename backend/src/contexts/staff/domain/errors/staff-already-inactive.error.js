const { DomainError } = require("./domain-error");

class StaffAlreadyInactiveError extends DomainError {
  constructor(staffId) {
    super("STAFF_ALREADY_INACTIVE", `El miembro del staff "${staffId}" ya está inactivo.`);
    this.staffId = staffId;
  }
}

module.exports = { StaffAlreadyInactiveError };
