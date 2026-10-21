const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env'), quiet: true });
const db = require('../backend/src/lib/prisma');
const express = require('../backend/node_modules/express');
const request = require('../backend/node_modules/supertest');

test('PostgreSQL real: acuerdo particular, transporte excluido de comisión, cobro único, compartido y permisos', async () => {
  const url = new URL(process.env.DATABASE_URL);
  const expectedPort = process.env.CI === 'true' ? '5432' : '5433';
  assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.port === expectedPort && url.pathname === '/mateos_dev', 'Requires loopback mateos_dev on the local or CI test port');
  const ids = [randomUUID(), randomUUID()];
  const rollback = new Error('ROLLBACK_GROOMING_TRANSPORT_FIXTURES');
  const cache = require.cache[require.resolve('../backend/src/lib/prisma')];
  let checks = 0;
  try {
    try {
      await db.$transaction(async tx => {
        // All routes and context repositories use the real PostgreSQL transaction.
        // Nested units of work reuse it so the full verification rolls back.
        cache.exports = new Proxy(tx, { get(target, key) { if (key === '$transaction') return fn => fn(target); const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; } });
        for (const id of ids) await tx.tenant.create({ data: { id, slug: `transport-test-${id}`, name: 'Disposable transport verification', phone: `fixture-${id}`, activeModules: ['grooming'], commissionSplitRate: 0.5 } });
        const category = await tx.serviceCategory.create({ data: { tenantId: ids[0], name: 'grooming', appliesCommissionSplit: true } });
        const service = await tx.service.create({ data: { tenantId: ids[0], categoryId: category.id, name: 'Fixture grooming', duration: 60, basePrice: 50000 } });
        const owner = await tx.user.create({ data: { tenantId: ids[0], phone: '000000009977', name: 'Fixture owner' } });
        const pet = await tx.pet.create({ data: { tenantId: ids[0], ownerId: owner.id, name: 'Fixture Luna', type: 'cat', defaultGroomingPrice: 95000, defaultGroomingWithTransportPrice: 103000 } });
        const staff = await tx.staff.create({ data: { tenantId: ids[0], name: 'Fixture groomer', role: 'groomer' } });
        const app = express(); app.use(express.json());
        app.use((req, _res, next) => { req.tenant = { tenantId: req.headers['x-fixture-tenant'] === 'foreign' ? ids[1] : ids[0], isSuperAdmin: false }; req.actor = { type: req.headers['x-fixture-role'] || 'admin', staffId: staff.id }; next(); });
        app.use('/api/dashboard', require('../backend/src/middleware/allowVeterinaryDashboard').allowVeterinaryDashboard);
        app.use('/api/dashboard', require('../backend/src/middleware/dashboard-operation-scope').dashboardOperationScope);
        app.use('/api/dashboard', require('../backend/src/routes/dashboard/grooming-transport.routes'));
        app.use('/api/dashboard', require('../backend/src/routes/dashboard/appointments.routes'));
        app.use('/api/dashboard', require('../backend/src/routes/dashboard/services.routes'));
        app.use('/api/dashboard', require('../backend/src/routes/dashboard/pets.routes'));
        const day = new Date('2026-10-20T15:00:00Z');
        async function appointment(petRow = pet, extra = {}) {
          return tx.appointment.create({ data: { tenantId: ids[0], userId: owner.id, petId: petRow.id, petName: petRow.name, petType: petRow.type, serviceId: service.id, staffId: staff.id, serviceType: 'grooming', date: day, status: 'in_progress', ...extra } });
        }
        let response = await request(app).post('/api/dashboard/services').send({ name: 'Fixture transport complement', category: 'grooming', duration: null, basePrice: null, requiresAppointment: false });
        assert.equal(response.status, 201, JSON.stringify(response.body)); assert.equal(response.body.duration, null); assert.equal(response.body.basePrice, null); assert.equal(response.body.requiresAppointment, false); checks++;
        response = await request(app).post('/api/dashboard/grooming/transport/zones').send({ name: 'Fixture zone', roundTripPrice: 16000, deliveryPrice: 9000 });
        assert.equal(response.status, 201, JSON.stringify(response.body)); const zone = response.body;
        response = await request(app).put(`/api/dashboard/pets/${pet.id}/grooming-prices`).send({ center: 95000, transport: 8000 });
        assert.equal(response.status, 200, JSON.stringify(response.body));
        const pricedPet = await tx.pet.findUniqueOrThrow({ where: { id: pet.id } });
        assert.equal(Number(pricedPet.defaultGroomingTransportPrice), 8000); assert.equal(pricedPet.defaultGroomingWithTransportPrice, null); checks++;
        const first = await appointment();
        const target = `/api/dashboard/appointments/${first.id}/transport`;
        response = await request(app).put(target).send({ mode: 'round_trip', zoneId: zone.id, address: 'Fixture confirmed address', confirmed: true });
        assert.equal(response.status, 200, JSON.stringify(response.body)); assert.equal(response.body.transport.price, 8000); assert.equal(response.body.finalPrice, 103000); checks++;
        response = await request(app).post(`/api/dashboard/appointments/${first.id}/complete`).send({});
        assert.equal(response.status, 200, JSON.stringify(response.body));
        const commission = await tx.commission.findFirstOrThrow({ where: { appointmentId: first.id } });
        const charge = await tx.transaction.findFirstOrThrow({ where: { appointmentId: first.id, origin: 'system_appointment_completed' } });
        assert.equal(Number(commission.resolvedPrice), 95000); assert.equal(Number(commission.staffShare), 47500); assert.equal(Number(charge.total), 103000); checks++;
        assert.equal(charge.paidAt, null);
        const { readOperationalCash } = require('../backend/src/routes/dashboard/operational-cash-page');
        const pendingCash = await readOperationalCash(cache.exports, ids[0], { scope: 'pending' }, { capabilities: { administration: true } });
        assert.equal(pendingCash.totalRegistered, 0); assert.equal(pendingCash.pendingCount, 1); assert.equal(pendingCash.summaryCash.pendingCents, 10300000); checks++;
        response = await request(app).post(`/api/dashboard/appointments/${first.id}/complete`).send({});
        assert.equal(response.status, 422); assert.equal(await tx.transaction.count({ where: { appointmentId: first.id } }), 1); assert.equal(await tx.commission.count({ where: { appointmentId: first.id } }), 1); checks++;
        const secondPet = await tx.pet.create({ data: { tenantId: ids[0], ownerId: owner.id, name: 'Fixture Toby', type: 'dog', defaultGroomingPrice: 45000 } });
        const second = await appointment(secondPet);
        response = await request(app).put(`/api/dashboard/appointments/${second.id}/transport`).send({ mode: 'shared', sharedWithId: first.id, scope: 'Both fixture pets' });
        assert.equal(response.status, 200, JSON.stringify(response.body)); assert.equal(response.body.finalPrice, 45000); assert.equal(response.body.transport.price, 0);
        response = await request(app).post(`/api/dashboard/appointments/${second.id}/complete`).send({});
        assert.equal(response.status, 200, JSON.stringify(response.body)); assert.equal(Number((await tx.transaction.findFirstOrThrow({ where: { appointmentId: second.id } })).total), 45000); checks++;
        const pending = await appointment(pet, { date: new Date(day.getTime() + 86400000) });
        response = await request(app).put(`/api/dashboard/appointments/${pending.id}/transport`).send({ mode: 'pickup', zoneId: zone.id, address: 'Fixture address', confirmed: false });
        assert.equal(response.status, 200); assert.equal(response.body.finalPrice, null);
        assert.equal((await request(app).post(`/api/dashboard/appointments/${pending.id}/complete`).send({})).status, 422);
        assert.equal(await tx.transaction.count({ where: { appointmentId: pending.id } }), 0); checks++;
        assert.equal((await request(app).put(`/api/dashboard/appointments/${pending.id}/transport`).set('x-fixture-tenant', 'foreign').send({ mode: 'none' })).status, 404); checks++;
        assert.equal((await request(app).put(`/api/dashboard/appointments/${pending.id}/transport`).set('x-fixture-role', 'receptionist').send({ mode: 'pickup', address: 'Fixture address', amount: 1, confirmed: true })).status, 403);
        assert.equal((await request(app).post('/api/dashboard/grooming/transport/zones').set('x-fixture-role', 'receptionist').send({ name: 'Forbidden' })).status, 403); checks++;
        response = await request(app).put(`/api/dashboard/grooming/transport/zones/${zone.id}`).send({ name: zone.name, roundTripPrice: 22000, pickupPrice: null, deliveryPrice: 15000, active: true });
        assert.equal(response.status, 200);
        const { mapAppointmentRow, APPOINTMENT_INCLUDE } = require('../backend/src/routes/dashboard/shared');
        const frozen = mapAppointmentRow(await tx.appointment.findUniqueOrThrow({ where: { id: first.id }, include: APPOINTMENT_INCLUDE }));
        assert.equal(frozen.finalPrice, 103000); assert.equal(frozen.priceResolution.servicePrice, 95000); checks++;
        const { generateDailyClose } = require('../backend/src/contexts/finance');
        const { dailyClose } = await generateDailyClose({ tenantId: ids[0], date: new Date() });
        assert.equal(Number(dailyClose.incomeTotal), 0); checks++;
        throw rollback;
      }, { timeout: 60000, maxWait: 10000 });
    } catch (error) { if (error !== rollback) throw error; }
    assert.equal(await db.tenant.count({ where: { id: { in: ids } } }), 0);
    console.log(JSON.stringify({ result: 'PASS', checks, database: 'PostgreSQL local', groomingAmount: 95000, transportAmount: 8000, customerCharge: 103000, groomerCommission: 47500, sharedTransportChargedOnce: true, fixtureRollback: true }));
  } finally { cache.exports = db; await db.$disconnect(); }
});
