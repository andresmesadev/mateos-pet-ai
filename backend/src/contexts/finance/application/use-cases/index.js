const { createRegisterExpenseUseCase } = require("./register-expense.usecase");
const { createVoidExpenseUseCase } = require("./void-expense.usecase");
const { createRecordChargeOnAppointmentCompletedUseCase } = require("./record-charge-on-appointment-completed.usecase");
const { createGenerateDailyCloseUseCase } = require("./generate-daily-close.usecase");
const { createGenerateFinancialPeriodUseCase } = require("./generate-financial-period.usecase");
const { createGetDailyCloseUseCase } = require("./get-daily-close.usecase");
const { createGetFinancialHistoryUseCase } = require("./get-financial-history.usecase");
const { createGetFinancialPeriodUseCase } = require("./get-financial-period.usecase");
// POS — proceso de cobro (Etapa 3 del Puente: viven en Finanzas, dueña del hecho)
const { createSettleSystemChargeUseCase } = require("./pos/settle-system-charge.usecase");
const { createGuardManualSaleLinkUseCase } = require("./pos/guard-manual-sale-link.usecase");
const { createVoidManualSaleUseCase } = require("./pos/void-manual-sale.usecase");

module.exports = {
  createSettleSystemChargeUseCase,
  createGuardManualSaleLinkUseCase,
  createVoidManualSaleUseCase,
  createRegisterExpenseUseCase,
  createVoidExpenseUseCase,
  createRecordChargeOnAppointmentCompletedUseCase,
  createGenerateDailyCloseUseCase,
  createGenerateFinancialPeriodUseCase,
  createGetDailyCloseUseCase,
  createGetFinancialHistoryUseCase,
  createGetFinancialPeriodUseCase,
};
