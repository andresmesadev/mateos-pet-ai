const { civilDateKey } = require('../../../shared/business-day');
function createCorrectCheckoutCommissionUseCase({ commissionRepository, voidCommission, businessDayGate, staffFinanceGate }) {
  return async function execute({ tenantId, appointmentId, servicePrice, actor }, ctx) {
    if (!ctx?.tx || !ctx.eventPublisher) throw new Error('Checkout correction requires transactional events');
    const commission = await commissionRepository.lockByAppointment(tenantId, appointmentId, ctx);
    if (!commission || Number(commission.resolvedPrice) === servicePrice) return null;
    if (staffFinanceGate && commission.staffId) await staffFinanceGate.acquire(tenantId, commission.staffId, ctx);
    await businessDayGate.acquire(tenantId, civilDateKey(commission.completedAt), ctx);
    return voidCommission({ tenantId, commissionId: commission.id,
      reason: `${servicePrice === null ? 'Cargo principal retirado; cobro por artículos' : 'Precio final del servicio confirmado'} en Caja por ${actor.actorName || actor.actorId} (${actor.actorId}).`,
      replacement: servicePrice === null ? null : { resolvedPrice: servicePrice } }, ctx);
  };
}
module.exports = { createCorrectCheckoutCommissionUseCase };
