const { InvalidTransactionOperationError } = require('../../domain/errors');
class PrismaPosReferencesReader {
  async validate(tenantId, { userId, petId, appointmentId }, ctx) {
    if (!ctx?.tx || !tenantId) throw new Error('POS references require tenant and transaction');
    const client = ctx.tx;
    if (userId && !await client.user.findFirst({ where: { id: userId, tenantId }, select: { id: true } })) throw new InvalidTransactionOperationError('Cliente no encontrado.');
    if (petId && !await client.pet.findFirst({ where: { id: petId, tenantId, ...(userId ? { ownerId: userId } : {}) }, select: { id: true } })) throw new InvalidTransactionOperationError('Mascota no encontrada para ese propietario.');
    if (appointmentId && !await client.appointment.findFirst({ where: { id: appointmentId, tenantId, ...(userId ? { userId } : {}), ...(petId ? { petId } : {}) }, select: { id: true } })) throw new InvalidTransactionOperationError('Cita no encontrada.');
  }
}
module.exports = { PrismaPosReferencesReader };
