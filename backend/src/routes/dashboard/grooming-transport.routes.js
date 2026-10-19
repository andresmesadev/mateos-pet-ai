const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { APPOINTMENT_INCLUDE, mapAppointmentRow, bogotaDayStart } = require('./shared');
const { TransportError, validMoney, pricingAppointment, prepareTransport, assertTransportCanChange, dateKey } = require('../../services/grooming-transport.service');
const canPrice = req => Boolean(req.access?.capabilities.appointmentPrice || req.access?.capabilities.administration || (!req.access && req.actor?.type === 'admin'));
const fail = (res, error) => {
  if (error instanceof TransportError) return res.status(error.status).json({ error: error.message });
  if (error.code === 'P2002') return res.status(409).json({ error: 'Ya existe una zona con ese nombre.' });
  console.error('[Transport] Error:', error.message);
  return res.status(500).json({ error: 'No se pudo guardar o consultar el domicilio.' });
};

router.get('/grooming/transport/zones', async (req, res) => {
  try {
    const rows = await prisma.groomingTransportZone.findMany({ where: { tenantId: req.tenant.tenantId }, orderBy: { name: 'asc' } });
    res.json(rows.map(row => canPrice(req) ? row : { id: row.id, name: row.name, active: row.active }));
  } catch (error) { fail(res, error); }
});

router.post('/grooming/transport/zones', async (req, res) => {
  try {
    const { name, roundTripPrice = null, pickupPrice = null, deliveryPrice = null, active = true } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || typeof active !== 'boolean' || [roundTripPrice, pickupPrice, deliveryPrice].some(value => value != null && !validMoney(value))) throw new TransportError('Revisa nombre, estado y precios de la zona.', 400);
    res.status(201).json(await prisma.groomingTransportZone.create({ data: { tenantId: req.tenant.tenantId, name: name.trim(), roundTripPrice, pickupPrice, deliveryPrice, active } }));
  } catch (error) { fail(res, error); }
});

router.put('/grooming/transport/zones/:id', async (req, res) => {
  try {
    const { name, roundTripPrice = null, pickupPrice = null, deliveryPrice = null, active = true } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 || typeof active !== 'boolean' || [roundTripPrice, pickupPrice, deliveryPrice].some(value => value != null && !validMoney(value))) throw new TransportError('Revisa nombre, estado y precios de la zona.', 400);
    const changed = await prisma.groomingTransportZone.updateMany({ where: { id: req.params.id, tenantId: req.tenant.tenantId }, data: { name: name.trim(), roundTripPrice, pickupPrice, deliveryPrice, active } });
    if (!changed.count) throw new TransportError('Zona no encontrada.', 404);
    res.json(await prisma.groomingTransportZone.findFirst({ where: { id: req.params.id, tenantId: req.tenant.tenantId } }));
  } catch (error) { fail(res, error); }
});

router.post('/grooming/transport/quote', async (req, res) => {
  try {
    const appointment = await pricingAppointment({ ...req.body, tenantId: req.tenant.tenantId });
    if (req.access?.role === 'groomer' && appointment.staffId && appointment.staffId !== req.actor.staffId) throw new TransportError('La atención está asignada a otro profesional.', 403);
    const result = req.body.transport?.mode === 'shared' && !req.body.transport.sharedWithId
      ? { quote: null } : await prepareTransport({ appointment, transport: req.body.transport, canConfirm: canPrice(req) });
    const start = bogotaDayStart(dateKey(appointment.date));
    const candidates = await prisma.appointment.findMany({ where: { tenantId: req.tenant.tenantId, userId: appointment.userId, id: { not: appointment.id ?? '' },
      date: { gte: start, lt: new Date(start.getTime() + 86400000) }, status: { notIn: ['cancelled', 'no_show'] }, transportMode: { in: ['round_trip', 'pickup', 'delivery'] }, transportPrice: { not: null } },
      select: { id: true, petName: true, date: true }, orderBy: { date: 'asc' }, take: 100 });
    res.json({ quote: canPrice(req) ? result.quote : null, sharedCandidates: canPrice(req) ? candidates : [] });
  } catch (error) { fail(res, error); }
});

router.put('/appointments/:id/transport', async (req, res) => {
  try {
    const updated = await prisma.$transaction(async tx => {
      const ids = [...new Set([req.params.id, ...(req.body?.mode === 'shared' && typeof req.body.sharedWithId === 'string' ? [req.body.sharedWithId] : [])])].sort();
      for (const id of ids) await tx.$queryRaw`SELECT id FROM "Appointment" WHERE id = ${id} AND "tenantId" = ${req.tenant.tenantId} FOR UPDATE`;
      const appointment = await pricingAppointment({ tenantId: req.tenant.tenantId, appointmentId: req.params.id }, tx);
      if (req.access?.role === 'groomer' && appointment.staffId !== req.actor.staffId) throw new TransportError('La atención debe estar asignada a tu usuario.', 403);
      const result = await prepareTransport({ appointment, transport: req.body, canConfirm: canPrice(req) }, tx);
      await assertTransportCanChange(tx, appointment, result.data);
      return tx.appointment.update({ where: { id: appointment.id }, data: result.data, include: APPOINTMENT_INCLUDE });
    });
    const mapped = mapAppointmentRow(updated);
    res.json(canPrice(req) || req.access?.capabilities.cash ? mapped : { ...mapped, finalPrice: null, priceResolution: null, transport: { ...mapped.transport, price: null }, hasResolvedPrice: mapped.finalPrice != null });
  } catch (error) { fail(res, error); }
});

module.exports = router;
