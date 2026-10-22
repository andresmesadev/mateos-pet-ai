// Dashboard coordination only; prices are still resolved by price-resolver.
const { changePetServicePriceInTransaction } = require('../contexts/services');
const { serviceModule } = require('./dashboard-access.service');
const { TransportError } = require('./grooming-transport.service');

async function savePetGroomingDefaults(tx, appointment, { price, transport, canPrice = false, afterCommit = [], forceAgreement = false }) {
  if (!appointment.petId || serviceModule(appointment) !== 'grooming') return;
  await tx.$queryRaw`SELECT id FROM "Pet" WHERE id = ${appointment.petId} AND "tenantId" = ${appointment.tenantId} FOR UPDATE`;
  const data = {};
  if (price != null && canPrice) {
    data.defaultGroomingPrice = price;
    // Habitual edits must not introduce a higher-priority per-service override.
    // Preserve/update one that already exists, or an explicitly agreed-price command.
    const agreement = appointment.serviceId && await tx.priceRule.findFirst({ where: { serviceId: appointment.serviceId, targetType: 'pet', targetId: appointment.petId, active: true, service: { tenantId: appointment.tenantId } }, select: { id: true } });
    if (appointment.serviceId && (agreement || forceAgreement)) await changePetServicePriceInTransaction({
      serviceId: appointment.serviceId, tenantId: appointment.tenantId,
      target: { type: 'pet', petId: appointment.petId }, newPrice: price,
    }, { tx, afterCommit });
  }
  if (transport && transport.transportMode !== 'shared') {
    data.defaultGroomingTransportMode = transport.transportMode;
    if (canPrice && transport.transportMode !== 'none') {
      data.defaultGroomingTransportPrice = transport.transportPrice;
      data.defaultGroomingWithTransportPrice = null;
    }
  }
  if (!Object.keys(data).length) return;
  const saved = await tx.pet.updateMany({ where: { id: appointment.petId, tenantId: appointment.tenantId }, data });
  if (saved.count !== 1) throw new TransportError('La mascota cambió. Actualiza la cita antes de guardar.', 409);
}

module.exports = { savePetGroomingDefaults };
