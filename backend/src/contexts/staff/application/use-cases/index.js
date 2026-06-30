const { createRegisterStaffUseCase } = require("./register-staff.usecase");
const { createUpdateStaffUseCase } = require("./update-staff.usecase");
const { createDeactivateStaffUseCase } = require("./deactivate-staff.usecase");
const { createReactivateStaffUseCase } = require("./reactivate-staff.usecase");
const { createUpdateAvailabilityUseCase } = require("./update-availability.usecase");
const { createManageStaffCapabilitiesUseCase } = require("./manage-staff-capabilities.usecase");
const { createRecordUnplannedAbsenceUseCase } = require("./record-unplanned-absence.usecase");
const { createRecordCommissionOnAppointmentCompletedUseCase } = require("./record-commission-on-appointment-completed.usecase");
const { createGenerateSettlementUseCase } = require("./generate-settlement.usecase");
const { createResolveStaffAvailabilityUseCase } = require("./resolve-staff-availability.usecase");
const { createListActiveStaffUseCase } = require("./list-active-staff.usecase");
const { createListSettlementsUseCase } = require("./list-settlements.usecase");

module.exports = {
  createRegisterStaffUseCase,
  createUpdateStaffUseCase,
  createDeactivateStaffUseCase,
  createReactivateStaffUseCase,
  createUpdateAvailabilityUseCase,
  createManageStaffCapabilitiesUseCase,
  createRecordUnplannedAbsenceUseCase,
  createRecordCommissionOnAppointmentCompletedUseCase,
  createGenerateSettlementUseCase,
  createResolveStaffAvailabilityUseCase,
  createListActiveStaffUseCase,
  createListSettlementsUseCase,
};
