const prisma = require('../lib/prisma');
const { resolveAppointmentTotal } = require('./domain/price-resolver.service');

class TransportError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; this.code = 'GROOMING_TRANSPORT'; }
}
const MODES = ['none', 'round_trip', 'pickup', 'delivery', 'shared'];
const PRICING_INCLUDE = {
  pet: { select: { defaultGroomingPrice: true, defaultGroomingWithTransportPrice: true, defaultGroomingTransportPrice: true } },
  service: { select: { basePrice: true, category: { select: { name: true } }, priceRules: { where: { active: true, targetType: 'pet' }, select: { targetId: true, price: true } } } },
  transportSharedWith: { select: { id: true, tenantId: true, userId: true, status: true, transportMode: true, transportPrice: true } },
};
function validMoney(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 99999999.99 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const dateKey = value => new Date(new Date(value).getTime() - 5 * 3600000).toISOString().slice(0, 10);

async function pricingAppointment({ tenantId, petId, serviceId, appointmentId, date }, client = prisma) {
  if (!tenantId) throw new TransportError('Selecciona un establecimiento.', 400);
  if (appointmentId) {
    const row = await client.appointment.findFirst({ where: { id: appointmentId, tenantId }, include: PRICING_INCLUDE });
    if (!row) throw new TransportError('Cita no encontrada.', 404);
    if (row.service?.category?.name !== 'grooming' && row.availabilityBucket !== 'grooming' && row.serviceType !== 'grooming') throw new TransportError('El transporte corresponde a una cita de peluquería.');
    return row;
  }
  if (!date || !Number.isFinite(new Date(date).getTime())) throw new TransportError('Selecciona la fecha de atención.', 400);
  const [pet, service] = await Promise.all([
    client.pet.findFirst({ where: { id: petId, tenantId } }),
    client.service.findFirst({ where: { id: serviceId, tenantId, active: true }, include: { category: true, priceRules: { where: { active: true, targetType: 'pet' }, select: { targetId: true, price: true } } } }),
  ]);
  if (!pet || !service) throw new TransportError('Mascota o servicio no encontrado.', 404);
  if (service.category?.name !== 'grooming') throw new TransportError('El transporte corresponde a una cita de peluquería.');
  return { tenantId, userId: pet.ownerId, petId, pet, serviceId, service, date, status: 'confirmed', transportMode: 'none' };
}

async function prepareTransport({ appointment, transport, canConfirm = false }, client = prisma) {
  if (!transport || typeof transport !== 'object' || Array.isArray(transport) || !MODES.includes(transport.mode)) throw new TransportError('Selecciona cómo llegará la mascota.', 400);
  const mode = transport.mode;
  const clear = { transportMode: mode, transportPrice: null, transportPriceSource: null, transportZoneId: null, transportZoneName: null,
    transportAddress: null, transportNeighborhood: null, transportScope: null, transportSharedWithId: null };
  if (mode === 'none') return { data: clear, quote: resolveAppointmentTotal({ ...appointment, ...clear }) };
  if (appointment.service?.category?.name !== 'grooming' && appointment.availabilityBucket !== 'grooming' && appointment.serviceType !== 'grooming') throw new TransportError('Solo se admite transporte en peluquería.');
  if ((transport.confirmed || transport.amount != null || mode === 'shared') && !canConfirm) throw new TransportError('No tienes permiso para confirmar el precio del domicilio.', 403);
  if (transport.confirmed !== undefined && typeof transport.confirmed !== 'boolean') throw new TransportError('La confirmación debe ser explícita.', 400);
  if (transport.amount != null && !validMoney(transport.amount)) throw new TransportError('Indica un importe válido de transporte.', 400);

  if (mode === 'shared') {
    if (transport.amount != null && transport.amount !== 0) throw new TransportError('El traslado compartido se cobra en la otra cita; no añadas otro importe.');
    const id = text(transport.sharedWithId, 100);
    if (!id || id === appointment.id) throw new TransportError('Selecciona otra cita que cubra el traslado.');
    const parent = await client.appointment.findFirst({ where: { id, tenantId: appointment.tenantId, userId: appointment.userId } });
    if (!parent || !['round_trip', 'pickup', 'delivery'].includes(parent.transportMode) || parent.transportPrice == null || ['cancelled', 'no_show'].includes(parent.status) || dateKey(parent.date) !== dateKey(appointment.date)) throw new TransportError('La otra cita debe ser del mismo propietario y día, con domicilio confirmado.');
    const data = { ...clear, transportSharedWithId: id, transportPrice: 0, transportPriceSource: 'shared', transportScope: text(transport.scope, 500) || 'Traslado incluido en otra cita del propietario' };
    return { data, quote: resolveAppointmentTotal({ ...appointment, ...data, transportSharedWith: parent }) };
  }

  const address = text(transport.address, 500);
  if (!address) throw new TransportError('Confirma la dirección para la recogida o entrega.');
  if (transport.neighborhood != null && (typeof transport.neighborhood !== 'string' || transport.neighborhood.trim().length > 200)) throw new TransportError('Indica un barrio válido de hasta 200 caracteres.', 400);
  let zone = null;
  if (transport.zoneId) {
    zone = await client.groomingTransportZone.findFirst({ where: { id: transport.zoneId, tenantId: appointment.tenantId, active: true } });
    if (!zone) throw new TransportError('Zona no disponible en este establecimiento.', 404);
  }
  const neighborhood = transport.neighborhood === undefined ? appointment.transportNeighborhood ?? null : text(transport.neighborhood, 200) || null;
  const data = { ...clear, transportAddress: address, transportNeighborhood: neighborhood, transportZoneId: zone?.id ?? null, transportZoneName: zone?.name ?? null, transportScope: text(transport.scope, 500) || null };
  const reference = resolveAppointmentTotal({ ...appointment, ...data }, zone);
  if (transport.confirmed) {
    const amount = transport.amount ?? reference.transportReferencePrice;
    if (!validMoney(amount)) throw new TransportError('El domicilio está pendiente de precio. Indica el importe que confirma el equipo.');
    data.transportPrice = amount;
    data.transportPriceSource = transport.amount != null ? 'manual' : reference.transportReferenceSource;
  }
  const quote = resolveAppointmentTotal({ ...appointment, ...data }, zone);
  return { data, quote };
}

async function assertTransportCanChange(client, appointment, nextData) {
  if (['completed', 'cancelled', 'no_show'].includes(appointment.status)) throw new TransportError('El transporte de esta atención ya no puede modificarse.');
  if (appointment.transportMode && appointment.transportMode !== 'none') {
    const covered = await client.appointment.count({ where: { tenantId: appointment.tenantId, transportSharedWithId: appointment.id, status: { notIn: ['cancelled', 'no_show'] } } });
    if (covered && (!['round_trip', 'pickup', 'delivery'].includes(nextData.transportMode) || nextData.transportPrice == null)) throw new TransportError('Este domicilio cubre otras citas. Reasigna esos traslados antes de retirarlo o dejar su precio pendiente.');
  }
}

module.exports = { TransportError, MODES, PRICING_INCLUDE, validMoney, pricingAppointment, prepareTransport, assertTransportCanChange, dateKey };
