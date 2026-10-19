const express = require('express');
const request = require('supertest');
jest.mock('../../lib/prisma', () => ({ $transaction: jest.fn() }));
jest.mock('../../services/dashboard-client.service', () => ({}));
jest.mock('../../services/next-action.service', () => ({}));
jest.mock('../../services/dashboard-reactivation.service', () => ({}));
const prisma = require('../../lib/prisma');
const routes = require('../../routes/dashboard/clients.routes');
const app = express();
app.use(express.json(), (req, res, next) => {
  req.tenant = { tenantId: 'clinic-a' };
  req.access = { capabilities: { administration: req.headers['x-test-admin'] !== 'no' } };
  next();
}, routes);
let tx;
const body = pets => ({ name: 'Ana', phone: '00000000001', tenantId: 'forged', pets });
beforeEach(() => {
  jest.resetAllMocks();
  tx = { user: { create: jest.fn().mockResolvedValue({ id: 'owner-a', name: 'Ana', phone: '00000000001' }) },
    pet: { create: jest.fn(async ({ data }) => ({ id: data.name, name: data.name, type: data.type })) } };
  prisma.$transaction.mockImplementation(fn => fn(tx));
});
test('creates multiple pet prices in the owner transaction, including zero and pending values', async () => {
  const response = await request(app).post('/clients/with-pets').send(body([
    { name: 'Luna', type: 'cat', defaultGroomingPrice: 60000, defaultGroomingTransportPrice: 12000 },
    { name: 'Toby', type: 'dog', defaultGroomingPrice: 0, defaultGroomingTransportPrice: null },
    { name: 'Mia', type: 'cat' },
  ]));
  expect(response.status).toBe(201);
  expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  expect(tx.user.create.mock.calls[0][0].data.tenantId).toBe('clinic-a');
  expect(tx.pet.create.mock.calls.map(([query]) => query.data)).toEqual([
    expect.objectContaining({ ownerId: 'owner-a', tenantId: 'clinic-a', defaultGroomingPrice: 60000, defaultGroomingTransportPrice: 12000 }),
    expect.objectContaining({ defaultGroomingPrice: 0, defaultGroomingTransportPrice: null }),
    expect.objectContaining({ defaultGroomingPrice: null, defaultGroomingTransportPrice: null }),
  ]);
});
test.each([-1, '50000', true, 1.001, 100000000])('rejects invalid price %p before creating the owner or any pets', async value => {
  const response = await request(app).post('/clients/with-pets').send(body([
    { name: 'Valid', type: 'cat' },
    { name: 'Invalid', type: 'dog', defaultGroomingTransportPrice: value },
  ]));
  expect(response.status).toBe(400);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test('rejects a combined amount beyond the monetary limit via the shared price resolver', async () => {
  const response = await request(app).post('/clients/with-pets').send(body([
    { name: 'Luna', type: 'cat', defaultGroomingPrice: 99999999.99, defaultGroomingTransportPrice: 1 },
  ]));
  expect(response.status).toBe(400);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test.each(['defaultGroomingPrice', 'defaultGroomingTransportPrice'])('a basic operator cannot assign %s, including zero', async field => {
  const response = await request(app).post('/clients/with-pets').set('x-test-admin', 'no').send(body([
    { name: 'Luna', type: 'cat', [field]: 0 },
  ]));
  expect(response.status).toBe(403);
  expect(prisma.$transaction).not.toHaveBeenCalled();
});
test('a basic operator can still create a pet with pending prices and handling alerts', async () => {
  const response = await request(app).post('/clients/with-pets').set('x-test-admin', 'no').send(body([
    { name: 'Luna', type: 'cat', operationalAlerts: 'Cuidado de prueba' },
  ]));
  expect(response.status).toBe(201);
  expect(tx.pet.create.mock.calls[0][0].data).toMatchObject({ operationalAlerts: 'Cuidado de prueba', defaultGroomingPrice: null, defaultGroomingTransportPrice: null });
});
