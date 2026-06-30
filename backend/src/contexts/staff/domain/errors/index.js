const { DomainError } = require("./domain-error");
const { StaffNotFoundError } = require("./staff-not-found.error");
const { StaffAlreadyInactiveError } = require("./staff-already-inactive.error");
const { StaffAlreadyActiveError } = require("./staff-already-active.error");
const { InvalidStaffAttributesError } = require("./invalid-staff-attributes.error");
const { InvalidAvailabilityRangeError } = require("./invalid-availability-range.error");
const { ReferencedServiceNotFoundError } = require("./referenced-service-not-found.error");
const { InvalidCommissionInputError } = require("./invalid-commission-input.error");
const { NoCommissionsForPeriodError } = require("./no-commissions-for-period.error");
const { SettlementAlreadyExistsError } = require("./settlement-already-exists.error");
const { DuplicateStaffCapabilityError } = require("./duplicate-staff-capability.error");

module.exports = {
  DomainError,
  StaffNotFoundError,
  StaffAlreadyInactiveError,
  StaffAlreadyActiveError,
  InvalidStaffAttributesError,
  InvalidAvailabilityRangeError,
  ReferencedServiceNotFoundError,
  InvalidCommissionInputError,
  NoCommissionsForPeriodError,
  SettlementAlreadyExistsError,
  DuplicateStaffCapabilityError,
};
