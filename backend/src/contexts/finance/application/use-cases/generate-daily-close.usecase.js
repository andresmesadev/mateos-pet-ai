const { summarizeDay } = require("../../domain/rules/financial-summary.rules");
const { DuplicateDailyCloseError, MissingTenantError, IncompleteDailyCloseError } = require("../../domain/errors");
const { civilDayBounds, civilDateLabel, civilDateKey } = require("../../../shared/business-day");

/**
 * GenerateDailyCloseUseCase — Administración.
 * Implementa "Generar Cierre del Día". Congela, para un día civil del negocio
 * (ADR 008), el resultado de consolidar Transaction activas (ambos orígenes) +
 * Expense activos + Commission activas (leídas, no recalculadas).
 *
 * Invariante ADR 007-D2: el cierre se rechaza si alguna cita completada del día
 * no tiene su obligación de cobro activa, pagada o pendiente (ADR 024).
 * Los ingresos consolidados usan únicamente la fecha real de pago.
 * Un evento puede perderse; un cierre incompleto
 * no puede existir. Es una lectura puntual de consistencia, no una dependencia
 * estructural hacia Agenda.
 *
 * @param {Object} deps — repositorios + commissionReader + completedAppointmentsReader + eventPublisher
 */
function createGenerateDailyCloseUseCase({
  transactionRepository,
  expenseRepository,
  commissionReader,
  completedAppointmentsReader,
  dailyCloseRepository,
  eventPublisher,
  businessDayGate,
}) {
  return async function execute({ tenantId, date }, ctx) {
    if (!tenantId) {
      throw new MissingTenantError();
    }

    const ymd = civilDateKey(date);
    const { start, end } = civilDayBounds(ymd);
    const label = civilDateLabel(ymd);

    if (businessDayGate) await businessDayGate.acquire(tenantId, ymd, ctx);
    const existing = await dailyCloseRepository.findByDate(tenantId, label, ctx);
    if (existing) {
      throw new DuplicateDailyCloseError(ymd);
    }

    const [charges, expenses, commissions, completedAppointments] = await Promise.all([
      transactionRepository.listByDateRange(tenantId, start, end, ctx),
      expenseRepository.listByDateRange(tenantId, start, end, ctx),
      commissionReader.listByDateRange(tenantId, start, end, ctx),
      completedAppointmentsReader.listCompletedInRange(tenantId, start, end, ctx),
    ]);

    const chargedAppointmentIds = new Set(
      charges
        .filter((c) => c.origin === "system_appointment_completed" && c.appointmentId)
        .map((c) => c.appointmentId)
    );
    const missing = completedAppointments.filter((a) => a.hasSystemCharge === false || (a.hasSystemCharge === undefined && !chargedAppointmentIds.has(a.id))).map((a) => a.id);
    if (missing.length > 0) {
      throw new IncompleteDailyCloseError(ymd, missing);
    }

    const summary = summarizeDay({ charges, expenses, commissions });

    let dailyClose;
    try {
      dailyClose = await dailyCloseRepository.create({
        tenantId,
        date: label,
        incomeTotal: summary.incomeTotal,
        expenseTotal: summary.expenseTotal,
        netAmount: summary.netAmount,
        staffBreakdown: summary.staffBreakdown,
      }, ctx);
    } catch (err) {
      if (err && err.code === "UNIQUE_DAILY_CLOSE_VIOLATION") {
        throw new DuplicateDailyCloseError(ymd);
      }
      throw err;
    }

    await (ctx?.eventPublisher ?? eventPublisher).publish("CierreDíaGenerado", { dailyClose });

    return { dailyClose };
  };
}

module.exports = { createGenerateDailyCloseUseCase };
