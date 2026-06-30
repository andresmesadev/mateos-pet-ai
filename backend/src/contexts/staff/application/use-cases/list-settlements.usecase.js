/**
 * ListSettlementsUseCase — Consulta.
 * Implementa "Consultar Liquidaciones". Lectura pura, sin recalcular montos.
 *
 * @param {Object} deps
 * @param {import("../ports/settlement-repository.port").SettlementRepositoryPort} deps.settlementRepository
 */
function createListSettlementsUseCase({ settlementRepository }) {
  return async function execute({ tenantId = null, staffId = null, periodStart = null, periodEnd = null }) {
    const settlements = await settlementRepository.list({ tenantId, staffId, periodStart, periodEnd });
    return { settlements };
  };
}

module.exports = { createListSettlementsUseCase };
