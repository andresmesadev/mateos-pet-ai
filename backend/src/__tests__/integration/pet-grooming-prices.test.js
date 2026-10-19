const express = require('express');
const request = require('supertest');
jest.mock('../../lib/prisma', () => ({ pet: { findFirst: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(), count: jest.fn() } }));
jest.mock('../../contexts/services', () => ({ changeServicePrice: jest.fn() }));
const prisma = require('../../lib/prisma');
const routes = require('../../routes/dashboard/pets.routes');
const app = express(); app.use(express.json());
app.use((req, _res, next) => { req.tenant = { tenantId: 'tenant-a' }; next(); });
app.use(routes);
const pet = { id: 'pet-a', defaultGroomingPrice: 95000, defaultGroomingWithTransportPrice: 103000, defaultGroomingTransportPrice: null };
beforeEach(() => { jest.clearAllMocks(); prisma.pet.findFirst.mockResolvedValue(pet); prisma.pet.updateMany.mockResolvedValue({ count: 1 }); });

test.each(['none', 'round_trip', 'pickup', 'delivery', null])('saves the habitual arrival mode %p in the authenticated pet only', async mode => {
  const response = await request(app).put('/pets/pet-a/grooming-prices').send({ center: 95000, transport: 8000, mode });
  expect(response.status).toBe(200);
  expect(response.body.mode).toBe(mode);
  expect(prisma.pet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'pet-a', tenantId: 'tenant-a' }, data: expect.objectContaining({ defaultGroomingTransportMode: mode }) }));
});

test('reads the saved modality and preserves it for older clients omitting mode', async () => {
  prisma.pet.findFirst.mockResolvedValue({ ...pet, defaultGroomingTransportMode: 'round_trip' });
  expect((await request(app).get('/pets/pet-a/grooming-prices')).body.mode).toBe('round_trip');
  const response = await request(app).put('/pets/pet-a/grooming-prices').send({ center: 95000, transport: 8000 });
  expect(response.body.mode).toBe('round_trip');
  expect(prisma.pet.updateMany.mock.calls[0][0].data).not.toHaveProperty('defaultGroomingTransportMode');
});

test.each(['shared', 'invalid', 1, {}, false])('rejects invalid habitual mode %p before writing', async mode => {
  expect((await request(app).put('/pets/pet-a/grooming-prices').send({ center: 95000, transport: 8000, mode })).status).toBe(400);
  expect(prisma.pet.updateMany).not.toHaveBeenCalled();
});
test('the list summary used to open a pet sheet preserves the owner address and identity', async () => {
  const owner = { id: 'owner-a', phone: '0000000000', name: 'Propietario ficticio', address: 'Calle de prueba, barrio de prueba' };
  prisma.pet.count.mockResolvedValue(1);
  prisma.pet.findMany.mockResolvedValue([{ ...pet, name: 'Luna', type: 'cat', owner, _count: { medicalRecords: 0, appointments: 0 } }]);
  const response = await request(app).get('/pets');
  expect(response.status).toBe(200); expect(response.body.data[0].owner).toEqual({ ...owner, neighborhood: owner.neighborhood ?? null });
  expect(prisma.pet.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a' } }));
});
test('a historical inclusive agreement displays service and fee without changing stored data', async () => {
  const response = await request(app).get('/pets/pet-a/grooming-prices');
  expect(response.status).toBe(200); expect(response.body).toMatchObject({ center: 95000, transport: 8000 });
  expect(prisma.pet.updateMany).not.toHaveBeenCalled();
});
test('saves the fee independently and retires the previous inclusive reference', async () => {
  const response = await request(app).put('/pets/pet-a/grooming-prices').send({ center: 95000, transport: 8000 });
  expect(response.status).toBe(200); expect(response.body).toMatchObject({ center: 95000, transport: 8000, quotedTotal: 103000 });
  expect(prisma.pet.updateMany).toHaveBeenCalledWith({ where: { id: 'pet-a', tenantId: 'tenant-a' }, data: { defaultGroomingPrice: 95000, defaultGroomingTransportPrice: 8000, defaultGroomingWithTransportPrice: null } });
});
test('an independent fee can be known while the service is pending; zero is preserved', async () => {
  for (const transport of [0, 8000]) {
    const response = await request(app).put('/pets/pet-a/grooming-prices').send({ center: null, transport });
    expect(response.status).toBe(200); expect(response.body).toMatchObject({ center: null, transport, quotedTotal: null });
  }
});
test('does not overwrite an isolated previous total with an incomplete breakdown', async () => {
  prisma.pet.findFirst.mockResolvedValue({ ...pet, defaultGroomingPrice: null });
  const response = await request(app).put('/pets/pet-a/grooming-prices').send({ center: 95000, transport: null });
  expect(response.status).toBe(422); expect(prisma.pet.updateMany).not.toHaveBeenCalled();
});
test('a foreign pet is not read or updated without its authenticated tenant', async () => {
  prisma.pet.findFirst.mockResolvedValue(null);
  expect((await request(app).put('/pets/foreign/grooming-prices').send({ center: 1, transport: 0 })).status).toBe(404);
  expect(prisma.pet.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'foreign', tenantId: 'tenant-a' } }));
  expect(prisma.pet.updateMany).not.toHaveBeenCalled();
});
test.each([-1, '8000', 0.001, 100000000])('rejects invalid transport %p before writing', async transport => {
  expect((await request(app).put('/pets/pet-a/grooming-prices').send({ center: 95000, transport })).status).toBe(400);
  expect(prisma.pet.updateMany).not.toHaveBeenCalled();
});
test('rejects a combined amount exceeding the charge column capacity', async () => {
  expect((await request(app).put('/pets/pet-a/grooming-prices').send({ center: 99999999, transport: 99999999 })).status).toBe(400);
  expect(prisma.pet.updateMany).not.toHaveBeenCalled();
});
