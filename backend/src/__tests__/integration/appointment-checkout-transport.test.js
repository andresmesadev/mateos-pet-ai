const express = require('express'), request = require('supertest');
jest.mock('../../lib/prisma', () => ({ appointment: { findFirst: jest.fn() } }));
jest.mock('../../routes/dashboard/shared', () => ({ APPOINTMENT_INCLUDE: {}, mapAppointmentRow: jest.fn() }));
jest.mock('../../services/dashboard-access.service', () => ({ serviceModule: row => row.serviceType === 'vet' ? 'veterinary' : 'grooming', moduleAllowsAppointment: () => true }));
const prisma = require('../../lib/prisma');
const { mapAppointmentRow } = require('../../routes/dashboard/shared');
const app = express();
app.use((req, _res, next) => { req.tenant = { tenantId: 'clinic' }; req.access = { capabilities: { cash: true } }; next(); });
app.use(require('../../routes/dashboard/access.routes'));
beforeEach(() => {
  jest.resetAllMocks();
  prisma.appointment.findFirst.mockResolvedValue({ id: 'visit', userId: 'owner', petId: 'pet', serviceType: 'grooming', status: 'completed', service: { name: 'Peluquería' } });
});
test.each([0, null, 8000])('pending checkout proposes transport only for a positive amount (%s)', async price => {
  mapAppointmentRow.mockReturnValue({ payment: { status: 'pending', transactionId: 'charge' }, priceResolution: { finalPrice: 58000 }, transport: { price }, petName: 'Luna', petType: 'dog' });
  const result = await request(app).get('/cash/appointments/visit/checkout');
  expect(result.status).toBe(200); expect(result.body.canAddTransport).toBe(true);
  expect(result.body.lines.map(line => line.appointmentComponent)).toEqual(price > 0 ? ['service', 'transport'] : ['service']);
  expect(prisma.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'clinic', id: 'visit' } }));
});
test('veterinary checkout does not propose a grooming transport button or line', async () => {
  prisma.appointment.findFirst.mockResolvedValue({ id: 'visit', serviceType: 'vet', status: 'completed' });
  mapAppointmentRow.mockReturnValue({ payment: { status: 'pending' }, priceResolution: { finalPrice: 60000 }, transport: { price: 0 } });
  const result = await request(app).get('/cash/appointments/visit/checkout');
  expect(result.status).toBe(200); expect(result.body.canAddTransport).toBe(false); expect(result.body.lines).toHaveLength(1);
});

test('a deferred non-grooming visit opens Caja with an empty price and no fabricated charge id', async () => {
  prisma.appointment.findFirst.mockResolvedValue({ id: 'visit', serviceType: 'vet', status: 'completed', service: { name: 'Vacunación' } });
  mapAppointmentRow.mockReturnValue({ payment: { status: 'pending', transactionId: null }, priceResolution: { finalPrice: null }, transport: { price: 0 } });
  const result = await request(app).get('/cash/appointments/visit/checkout');
  expect(result.status).toBe(200); expect(result.body.transactionId).toBeNull();
  expect(result.body.lines).toEqual([expect.objectContaining({ description: 'Vacunación', unitPrice: '', appointmentComponent: 'service' })]);
});
test('a paid charge remains read-only and an unavailable appointment is not exposed', async () => {
  mapAppointmentRow.mockReturnValue({ payment: { status: 'paid' } });
  expect((await request(app).get('/cash/appointments/visit/checkout')).status).toBe(409);
  prisma.appointment.findFirst.mockResolvedValue(null);
  expect((await request(app).get('/cash/appointments/foreign/checkout')).status).toBe(404);
});
