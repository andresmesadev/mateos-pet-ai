const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
require('../backend/node_modules/dotenv').config({ path: path.join(__dirname, '../backend/.env'), quiet: true });

// Only the local development database; never the VPS or an external provider.
const db = new URL(process.env.DATABASE_URL);
assert(['localhost', '127.0.0.1', '[::1]'].includes(db.hostname) && db.pathname === '/mateos_dev');
const prisma = require('../backend/src/lib/prisma');
const calendar = require('../backend/src/services/google-calendar.service');
calendar.createCalendarEvent = async () => null;
calendar.cancelCalendarEvent = async () => null;
const { createAppointment, rescheduleAppointment, cancelAppointment, buildAppointmentDateTime } = require('../backend/src/services/appointment.service');

test('Asistente: reservas y reprogramaciones concurrentes con PostgreSQL real', async t => {
  const tenantId = randomUUID();
  const marker = 'assistant-agenda-' + tenantId;
  const at = (day, hour) => buildAppointmentDateTime('2099-01-' + day, hour);
  let owners;
  const reserve = (owner, day, hour) => createAppointment({ tenantId, userId: owner.user.id,
    petId: owner.pet.id, petName: owner.pet.name, petType: 'dog', serviceType: 'vet', date: at(day, hour), status: 'pending' });
  const move = (appointment, date, owner) => rescheduleAppointment({ tenantId,
    userId: owner.user.id, appointmentId: appointment.id, date });
  try {
    const hours = Object.fromEntries(['mon','tue','wed','thu','fri','sat'].map(day => [day, { active: true, open: '11:00', close: '17:00' }]));
    await prisma.tenant.create({ data: { id: tenantId, slug: marker, phone: marker,
      name: 'Prueba aislada del asistente', activeModules: ['veterinary','grooming'], businessHours: hours } });
    owners = await Promise.all(['A','B'].map(async name => {
      const user = await prisma.user.create({ data: { tenantId, name: 'Dueño ' + name, phone: marker + name } });
      const pet = await prisma.pet.create({ data: { tenantId, ownerId: user.id, name: 'Mascota ' + name, type: 'dog' } });
      return { user, pet };
    }));
    await t.test('dos clientes reservan un mismo turno: solo uno persiste', async () => {
      const results = await Promise.allSettled(owners.map(owner => reserve(owner, '05', 12)));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.filter(r => r.status === 'rejected').length, 1);
      assert.equal(await prisma.appointment.count({ where: { tenantId, date: at('05', 12), status: { not: 'cancelled' } } }), 1);
    });
    const original = await reserve(owners[0], '06', 11);
    const occupied = await reserve(owners[1], '06', 12);
    await t.test('destino ocupado conserva ID, fecha y estado de la cita original', async () => {
      await assert.rejects(move(original, occupied.date, owners[0]));
      const unchanged = await prisma.appointment.findUniqueOrThrow({ where: { id: original.id } });
      assert.equal(unchanged.date.getTime(), original.date.getTime());
      assert.equal(unchanged.status, 'pending');
    });
    await t.test('otra persona no puede mover ni cancelar la cita', async () => {
      await assert.rejects(move(original, at('06', 14), owners[1]));
      assert.equal(await cancelAppointment(owners[1].user.id, original.id, tenantId), null);
      assert.equal((await prisma.appointment.findUniqueOrThrow({ where: { id: original.id } })).date.getTime(), original.date.getTime());
    });
    await t.test('dos reprogramaciones al mismo destino: una gana y la otra conserva su original', async () => {
      const target = at('06', 14);
      const results = await Promise.allSettled([move(original, target, owners[0]), move(occupied, target, owners[1])]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1, JSON.stringify(results.map(r => r.status === 'rejected' ? r.reason.message : r.value.id)));
      assert.equal(results.filter(r => r.status === 'rejected').length, 1);
      for (const [i, appointment] of [original, occupied].entries()) {
        const actual = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
        assert.equal(actual.userId, owners[i].user.id);
        assert.equal(actual.petId, owners[i].pet.id);
        assert.equal(actual.status, 'pending');
        assert.equal(actual.date.getTime(), results[i].status === 'fulfilled' ? target.getTime() : appointment.date.getTime());
      }
      assert.equal(await prisma.appointment.count({ where: { tenantId, date: target } }), 1);
    });
    await t.test('una reserva nueva y una reprogramación compiten bajo el mismo bloqueo', async () => {
      const source = await reserve(owners[0], '07', 11);
      const target = at('07', 13);
      const results = await Promise.allSettled([move(source, target, owners[0]), reserve(owners[1], '07', 13)]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.filter(r => r.status === 'rejected').length, 1);
      assert.equal(await prisma.appointment.count({ where: { tenantId, date: target, status: { not: 'cancelled' } } }), 1);
      const actual = await prisma.appointment.findUniqueOrThrow({ where: { id: source.id } });
      assert.equal(actual.date.getTime(), results[0].status === 'fulfilled' ? target.getTime() : source.date.getTime());
      assert.equal(actual.status, 'pending');
    });
  } finally {
    // Delete only fixtures owned by this run, after verifying all markers.
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant) {
      assert.equal(tenant.slug, marker); assert.equal(tenant.phone, marker);
      assert.equal(tenant.name, 'Prueba aislada del asistente');
      await prisma.$transaction(async tx => {
        await tx.appointment.deleteMany({ where: { tenantId } });
        await tx.pet.deleteMany({ where: { tenantId } });
        await tx.user.deleteMany({ where: { tenantId } });
        await tx.tenant.delete({ where: { id: tenantId } });
      });
    }
    await prisma.$disconnect();
  }
});
