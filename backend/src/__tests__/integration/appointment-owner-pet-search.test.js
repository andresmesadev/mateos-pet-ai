const express = require('express');
const request = require('supertest');
jest.mock('../../lib/prisma', () => ({ user: { findMany: jest.fn() } }));
jest.mock('../../services/dashboard-client.service', () => ({ listClients: jest.fn() }));
jest.mock('../../services/next-action.service', () => ({ sendNextActionReminders: jest.fn() }));
jest.mock('../../services/dashboard-reactivation.service', () => ({}));
const prisma = require('../../lib/prisma');
const router = require('../../routes/dashboard/clients.routes');
const app = express();
app.use((req, res, next) => { req.tenant = { tenantId: 'clinic-a' }; next(); }, router);
beforeEach(() => jest.resetAllMocks());

test.each(['Luna', 'Carolina', '3001234567'])('quick search accepts owner, phone or pet: %s', async term => {
  const oldPet = { id: 'old-pet', name: 'Luna', type: 'cat' };
  const recentPet = { id: 'new-pet', name: 'Toby', type: 'dog' };
  prisma.user.findMany.mockResolvedValueOnce([{ id: 'owner', name: 'Carolina', phone: '3001234567', pets: [recentPet] }])
    .mockResolvedValueOnce([{ id: 'owner', pets: term === 'Luna' ? [oldPet] : [] }]);
  const response = await request(app).get('/clients').query({ search: term, limit: 8 });
  expect(response.status).toBe(200);
  expect(response.body[0]).toMatchObject({ id: 'owner', name: 'Carolina', phone: '3001234567' });
  expect(response.body[0].pets).toContainEqual(recentPet);
  if (term === 'Luna') expect(response.body[0].matchingPets).toEqual([oldPet]);
  const ownerQuery = prisma.user.findMany.mock.calls[0][0];
  expect(ownerQuery.where).toMatchObject({ tenantId: 'clinic-a', OR: expect.arrayContaining([
    { name: { contains: term, mode: 'insensitive' } },
    { phone: { contains: term } },
    { pets: { some: { tenantId: 'clinic-a', name: { contains: term, mode: 'insensitive' } } } },
  ]) });
  expect(prisma.user.findMany.mock.calls[1][0]).toMatchObject({
    where: { tenantId: 'clinic-a', id: { in: ['owner'] } },
    select: { pets: { where: { tenantId: 'clinic-a', name: { contains: term, mode: 'insensitive' } }, take: 5 } },
  });
});

test('no matches returns an empty list without a second lookup', async () => {
  prisma.user.findMany.mockResolvedValueOnce([]);
  expect((await request(app).get('/clients?search=absent&limit=8')).body).toEqual([]);
  expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
});

test('a recent matched pet is returned once and owner results remain bounded', async () => {
  const pet = { id: 'pet', name: 'Luna', type: 'cat' };
  prisma.user.findMany.mockResolvedValueOnce([{ id: 'owner', name: 'A', phone: '123', pets: [pet] }])
    .mockResolvedValueOnce([{ id: 'owner', pets: [pet] }]);
  const result = await request(app).get('/clients?search=Luna&limit=20');
  expect(result.body[0].pets).toEqual([pet]);
  expect(prisma.user.findMany.mock.calls[0][0].take).toBe(20);
});
