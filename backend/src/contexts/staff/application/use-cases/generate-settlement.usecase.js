const {
  StaffNotFoundError,
  NoCommissionsForPeriodError,
  SettlementAlreadyExistsError,
} = require("../../domain/errors");

/**
 * GenerateSettlementUseCase — Operación.
 * Implementa "Generar Liquidación de Período". Una Liquidación nunca se
 * reemplaza: doble protección del invariante (aplicación aquí, índice
 * único parcial en base de datos).
 *
 * @param {Object} deps
 * @param {import("../ports/staff-repository.port").StaffRepositoryPort} deps.staffRepository
 * @param {import("../ports/commission-repository.port").CommissionRepositoryPort} deps.commissionRepository
 * @param {import("../ports/settlement-repository.port").SettlementRepositoryPort} deps.settlementRepository
 * @param {import("../ports/domain-event-publisher.port").DomainEventPublisherPort} deps.eventPublisher
 */
function createGenerateSettlementUseCase({ staffRepository, commissionRepository, settlementRepository, eventPublisher }) {
  return async function execute({ tenantId, staffId, periodStart, periodEnd }) {
    const staff = await staffRepository.findById(staffId);
    if (!staff || (tenantId && staff.tenantId !== tenantId)) {
      throw new StaffNotFoundError(staffId);
    }

    const existing = await settlementRepository.findActiveByStaffAndPeriod(staffId, periodStart, periodEnd);
    if (existing) {
      throw new SettlementAlreadyExistsError(staffId, periodStart, periodEnd);
    }

    const commissions = await commissionRepository.listByStaffAndPeriod(staffId, periodStart, periodEnd);
    if (commissions.length === 0) {
      throw new NoCommissionsForPeriodError(staffId, periodStart, periodEnd);
    }

    const totalAmount = commissions.reduce((sum, c) => sum + Number(c.staffShare), 0);

    let settlement;
    try {
      settlement = await settlementRepository.create({
        tenantId: tenantId ?? null,
        staffId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalAmount: Math.round(totalAmount * 100) / 100,
        status: "active",
      });
    } catch (err) {
      if (err && err.code === "UNIQUE_SETTLEMENT_VIOLATION") {
        throw new SettlementAlreadyExistsError(staffId, periodStart, periodEnd);
      }
      throw err;
    }

    await eventPublisher.publish("LiquidaciónGenerada", { settlement });

    return { settlement };
  };
}

module.exports = { createGenerateSettlementUseCase };
