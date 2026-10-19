const { civilDateKey } = require('../../../shared/business-day');
function createCorrectCheckoutCommissionUseCase({ commissionRepository, voidCommission, businessDayGate, staffFinanceGate }) {
  return async function execute({ tenantId, appointmentId, servicePrice, actor }, ctx) {
    if (!ctx?.tx || !ctx.eventPublisher) throw new Error('Checkout correction requires transactional events');
    const commission = await commissionRepository.lockByAppointment(tenantId, appointmentId, ctx);
    if (!commission || Number(commission.resolvedPrice) === servicePrice) return null;
    if (staffFinanceGate && commission.staffId) await staffFinanceGate.acquire(tenantId, commission.staffId, ctx);
    await businessDayGate.acquire(tenantId, civilDateKey(commission.completedAt), ctx);
    return voidCommission({ tenantId, commissionId: commission.id,
      reason: `Precio final de peluquería confirmado en Caja por ${actor.actorName || actor.actorId} (${actor.actorId}).`,
      replacement: { resolvedPrice: servicePrice } }, ctx);
  };
}
module.exports = { createCorrectCheckoutCommissionUseCase };
