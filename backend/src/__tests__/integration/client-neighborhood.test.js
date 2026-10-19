const express = require('express');
const request = require('supertest');
jest.mock('../../lib/prisma', () => ({ user: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() }, $transaction: jest.fn() }));
jest.mock('../../services/next-action.service', () => ({}));
jest.mock('../../services/dashboard-reactivation.service', () => ({}));
const prisma = require('../../lib/prisma');
const routes = require('../../routes/dashboard/clients.routes');
const app = express();
app.use(express.json(), (req, res, next) => {
  req.tenant = { tenantId: 'clinic-a' };
  req.access = { capabilities: { administration: req.headers['x-test-basic'] !== 'yes' } };
  req.actor = { type: req.access.capabilities.administration ? 'admin' : 'reception' };
  next();
}, routes);
let row;
beforeEach(() => {
  jest.resetAllMocks();
  row = { id: 'owner-a', tenantId: 'clinic-a', name: 'Ana', phone: '0000000001', neighborhood: 'Barrio previo', address: 'Dirección previa', notes: 'Notas reservadas', pets: [], appointments: [], conversations: [], _count: { conversations: 0 }, createdAt: new Date() };
  prisma.user.findFirst.mockImplementation(async ({ where }) => where.id === row.id && where.tenantId === row.tenantId ? row : null);
  prisma.user.update.mockImplementation(async ({ data }) => {
    for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value;
    return row;
  });
});
test('updates and reads a trimmed neighborhood without changing address or notes', async () => {
  const updated = await request(app).patch('/clients/owner-a').send({ neighborhood: '  Robledo Miramar  ' });
  expect(updated.status).toBe(200);
  expect(updated.body).toMatchObject({ neighborhood: 'Robledo Miramar', address: 'Dirección previa', notes: 'Notas reservadas' });
  const detail = await request(app).get('/clients/owner-a');
  expect(detail.body.neighborhood).toBe('Robledo Miramar');
});
test('omission preserves the neighborhood and empty text clears it', async () => {
  expect((await request(app).patch('/clients/owner-a').send({ name: 'Ana actualizada' })).body.neighborhood).toBe('Barrio previo');
  expect((await request(app).patch('/clients/owner-a').send({ neighborhood: '' })).body.neighborhood).toBeNull();
});
test.each([123, 'x'.repeat(201)])('rejects invalid neighborhood %p before editing or creating contacts', async neighborhood => {
  expect((await request(app).patch('/clients/owner-a').send({ neighborhood })).status).toBe(400);
  expect((await request(app).post('/clients').send({ phone: '1', neighborhood })).status).toBe(400);
  expect((await request(app).post('/clients/with-pets').send({ name: 'A', phone: '1', neighborhood, pets: [] })).status).toBe(400);
  expect(prisma.user.update).not.toHaveBeenCalled(); expect(prisma.user.create).not.toHaveBeenCalled(); expect(prisma.$transaction).not.toHaveBeenCalled();
});
test('a neighborhood cannot update an owner outside the authenticated clinic', async () => {
  expect((await request(app).patch('/clients/foreign-owner').send({ neighborhood: 'No autorizado' })).status).toBe(404);
  expect(prisma.user.update).not.toHaveBeenCalled();
});
test('basic contact operators may edit neighborhood without receiving private notes', async () => {
  const response = await request(app).patch('/clients/owner-a').set('x-test-basic', 'yes').send({ neighborhood: 'Barrio operativo' });
  expect(response.status).toBe(200); expect(response.body.neighborhood).toBe('Barrio operativo');
  expect(response.body).not.toHaveProperty('notes'); expect(row.notes).toBe('Notas reservadas');
});
