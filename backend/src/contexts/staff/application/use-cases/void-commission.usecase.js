const { calculateCommissionSplit } = require("../../domain/rules/commission-calculation.rules");
const {
  InvalidCommissionInputError,
  CommissionNotFoundError,
  CommissionAlreadyVoidedError,
  CommissionDayClosedError,
  CommissionInActiveSettlementError,
} = require("../../domain/errors");

/**
 * VoidCommissionUseCase — Administración (actor humano). ADR 009.
 * Un ÚNICO comando atómico: anula la comisión vigente y crea su reemplazo en la
 * misma transacción (Decisión 3). La anulación sin reemplazo solo existe como
 * decisión explícita (replacement: null — cita que nunca debió generar comisión).
 *
 * Fronteras (Decisión 4): no sobre días con Cierre oficial; no sobre comisiones
 * consolidadas en una Settlement activa.
 *
 * Con el split aún no configurable (deuda registrada hacia Negocio), la tasa
 * vigente al corregir es la misma registrada en la comisión original.
 *
 * @param {Object} deps
 * @param {Object} deps.commissionRepository — findById / voidAndReplace
 * @param {{ findActiveCovering(staffId: string, at: Date): Promise<Object|null> }} deps.settlementCoverageReader
 * @param {{ findByCivilDay(tenantId: ?string, at: Date): Promise<Object|null> }} deps.dailyCloseReader
 * @param {{ publish(name: string, payload: Object): Promise<void> }} deps.eventPublisher
 */
function createVoidCommissionUseCase({ commissionRepository, settlementCoverageReader, dailyCloseReader, eventPublisher }) {
  return async function execute({ tenantId, commissionId, reason, replacement }) {
    if (!reason || !reason.trim()) {
      throw new InvalidCommissionInputError("reason es obligatorio para anular una comisión.");
    }

    const commission = await commissionRepository.findById(commissionId);
    if (!commission || (tenantId && commission.tenantId !== tenantId)) {
      throw new CommissionNotFoundError(commissionId);
    }
    if (commission.status === "voided") {
      throw new CommissionAlreadyVoidedError(commissionId);
    }

    const close = await dailyCloseReader.findByCivilDay(commission.tenantId ?? null, commission.completedAt);
    if (close) {
      throw new CommissionDayClosedError(close.date.toISOString().slice(0, 10));
    }

    if (commission.staffId) {
      const settlement = await settlementCoverageReader.findActiveCovering(commission.staffId, commission.completedAt);
      if (settlement) {
        throw new CommissionInActiveSettlementError(commissionId, settlement.id);
      }
    }

    let replacementData = null;
    if (replacement) {
      const correctedPrice = Number(replacement.resolvedPrice);
      if (!Number.isFinite(correctedPrice) || correctedPrice < 0) {
        throw new InvalidCommissionInputError("resolvedPrice del reemplazo no puede ser nulo ni negativo.");
      }
      const splitRate = Number(commission.splitRate);
      const { staffShare, businessShare } = calculateCommissionSplit(correctedPrice, splitRate);
      replacementData = {
        tenantId: commission.tenantId ?? null,
        appointmentId: commission.appointmentId,
        staffId: replacement.staffId ?? commission.staffId ?? null,
        resolvedPrice: correctedPrice,
        priceSource: "manual_override",
        splitRate,
        staffShare,
        businessShare,
        serviceCategory: commission.serviceCategory,
        completedAt: commission.completedAt,
        replacesCommissionId: commission.id,
      };
    }

    const result = await commissionRepository.voidAndReplace(commissionId, {
      voidedAt: new Date(),
      voidReason: reason,
      replacement: replacementData,
    });

    await eventPublisher.publish("ComisiónAnulada", {
      commission: result.voided,
      replacement: result.replacement ?? null,
    });

    return { voided: result.voided, replacement: result.replacement ?? null };
  };
}

module.exports = { createVoidCommissionUseCase };
