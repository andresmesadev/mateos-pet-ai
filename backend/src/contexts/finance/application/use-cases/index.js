const { createRegisterExpenseUseCase } = require("./register-expense.usecase");
const { createVoidExpenseUseCase } = require("./void-expense.usecase");
const { createRecordChargeOnAppointmentCompletedUseCase } = require("./record-charge-on-appointment-completed.usecase");
const { createGenerateDailyCloseUseCase } = require("./generate-daily-close.usecase");
const { createGenerateFinancialPeriodUseCase } = require("./generate-financial-period.usecase");
const { createGetDailyCloseUseCase } = require("./get-daily-close.usecase");
const { createGetFinancialHistoryUseCase } = require("./get-financial-history.usecase");
const { createGetFinancialPeriodUseCase } = require("./get-financial-period.usecase");

module.exports = {
  createRegisterExpenseUseCase,
  createVoidExpenseUseCase,
  createRecordChargeOnAppointmentCompletedUseCase,
  createGenerateDailyCloseUseCase,
  createGenerateFinancialPeriodUseCase,
  createGetDailyCloseUseCase,
  createGetFinancialHistoryUseCase,
  createGetFinancialPeriodUseCase,
};
