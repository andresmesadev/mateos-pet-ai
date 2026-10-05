// Called exclusively by the disposable local UI harness; never by the backend app.
module.exports = async function seedFollowups(prisma, tenant) {
  const assert = require('node:assert/strict');
  process.env.ADMIN_EMAIL = 'followup-ui@example.invalid';
  process.env.ADMIN_PASSWORD = 'LocalFollowupCheck2026!';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'private-test';
  process.env.WHATSAPP_ACCESS_TOKEN = 'private-test';
  process.env.WHATSAPP_TEMPLATE_REACTIVACION_NAME = 'private-test';
  process.env.WHATSAPP_TEMPLATE_REACTIVACION_LANG = 'es';
  const template = require('../backend/src/services/reactivation-template.service');
  let mockSends = 0;
  template.sendReactivationTemplate = async ({ clientName }) => { mockSends++; return clientName !== 'Beatriz prueba'; };
  const owners = [];
  const now = new Date();
  for (const [index, name] of ['Ana prueba', 'Beatriz prueba', 'Sin teléfono prueba'].entries()) {
    const owner = await prisma.user.create({ data: { tenantId: tenant.id, name, phone: index === 2 ? 'NOPHONE-QA' : '57300123456' + index } });
    const pet = await prisma.pet.create({ data: { tenantId: tenant.id, ownerId: owner.id, name: index === 0 ? 'Luna prueba' : 'Mascota ' + index, type: 'dog' } });
    for (const ago of [120, 90]) await prisma.medicalRecord.create({ data: { petId: pet.id, type: 'grooming', title: 'Baño de prueba', date: new Date(now.getTime() - ago * 86400000) } });
    owners.push({ owner, pet });
  }
  const { owner, pet } = owners[0];
  await prisma.conversation.create({ data: { tenantId: tenant.id, userId: owner.id, status: 'cerrada' } });
  const old = await prisma.medicalRecord.create({ data: { petId: pet.id, type: 'control', title: 'Control asociado ya cerrado', nextControlAt: now } });
  await prisma.petNextAction.create({ data: { tenantId: tenant.id, petId: pet.id, type: 'control', dueAt: now, status: 'done', sourceRecordId: old.id } });
  await prisma.medicalRecord.create({ data: { petId: pet.id, type: 'vaccine', title: 'Vacuna anterior sin vínculo', nextControlAt: new Date(now.getTime() + 86400000) } });
  for (let index = 0; index < 22; index++) await prisma.petNextAction.create({ data: { tenantId: tenant.id, petId: pet.id, type: index % 2 ? 'grooming' : 'control', notes: 'Seguimiento de prueba ' + index, dueAt: new Date(now.getTime() + (index - 3) * 86400000) } });
  const otherTenant = await prisma.tenant.create({ data: { name: 'Otro establecimiento privado', slug: tenant.slug + '-other', phone: tenant.phone + '-other', activeModules: ['veterinary'] } });
  const otherOwner = await prisma.user.create({ data: { tenantId: otherTenant.id, name: 'NO DEBE APARECER', phone: '573001234599' } });
  const otherPet = await prisma.pet.create({ data: { tenantId: otherTenant.id, ownerId: otherOwner.id, name: 'Mascota ajena', type: 'dog' } });
  await prisma.petNextAction.create({ data: { tenantId: otherTenant.id, petId: otherPet.id, type: 'control', dueAt: now } });
  const { readFollowups } = require('../backend/src/services/dashboard-followup.service');
  const data = await readFollowups(tenant.id, ['veterinary', 'grooming']);
  assert.equal(data.total, 23); assert.equal(Object.values(data.byType).flat().length, 20);
  const second = await readFollowups(tenant.id, ['veterinary', 'grooming'], { page: '2' });
  assert.equal(Object.values(second.byType).flat().length, 3);
  assert.equal((await readFollowups(tenant.id, ['grooming'])).total, 11);
  assert.equal((await readFollowups(tenant.id, ['retail'])).total, 0);
  console.log('PostgreSQL followups verified: 23 pending, 20+3 pages, linked closed record suppressed, grooming=11, retail=0, other tenant excluded.');
  if (process.argv.includes('--seed-followup-pagination')) {
    await prisma.user.update({ where: { id: owners[1].owner.id }, data: { lastReminderSentAt: new Date(now.getTime() - 2 * 86400000) } });
    await prisma.user.createMany({ data: Array.from({ length: 521 }, (_, index) => ({ id: `qa-followup-owner-${String(index).padStart(3, '0')}`, tenantId: tenant.id, name: index === 520 ? 'Objetivo fuera del recorte' : `Cliente paginado ${index}`, phone: `573111${String(index).padStart(6, '0')}`, ...(index === 0 ? { lastReminderSentAt: now } : {}) })) });
    await prisma.pet.createMany({ data: Array.from({ length: 521 }, (_, index) => ({ id: `qa-followup-pet-${index}`, tenantId: tenant.id, ownerId: `qa-followup-owner-${String(index).padStart(3, '0')}`, name: index === 520 ? 'Mascota fuera del recorte' : `Mascota paginada ${index}`, type: 'dog' })) });
    await prisma.medicalRecord.createMany({ data: Array.from({ length: 521 }, (_, index) => ({ petId: `qa-followup-pet-${index}`, type: 'grooming', title: 'Visita paginada', date: new Date(now.getTime() - (100 + index) * 86400000) })) });
    const { listInactiveClientsPage } = require('../backend/src/services/dashboard-inactive-clients.service');
    const first = await listInactiveClientsPage(tenant.id);
    const last = await listInactiveClientsPage(tenant.id, { page: '999' });
    assert.equal(first.total, 524); assert.equal(first.data.length, 20); assert.equal(last.page, 27); assert.equal(last.data.length, 4);
    assert.equal((await listInactiveClientsPage(tenant.id, { search: 'Mascota fuera del recorte' })).data[0].name, 'Objetivo fuera del recorte');
    assert.equal((await listInactiveClientsPage(tenant.id, { search: 'NO DEBE APARECER' })).total, 0);
    assert.equal((await listInactiveClientsPage(tenant.id, { contact: 'never' })).total, 522);
    assert.equal((await listInactiveClientsPage(tenant.id, { contact: 'recorded' })).total, 2);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(now);
    assert.equal((await listInactiveClientsPage(tenant.id, { contact: 'recorded', contactFrom: today, contactTo: today })).total, 1);
    const periods = await readFollowups(tenant.id, ['veterinary', 'grooming'], { period: 'today' });
    assert.deepEqual(periods.periodCounts, { all: 23, past: 3, today: 1, next7: 8 });
    assert.equal(periods.total, 1); assert.equal(Object.values(periods.byType).flat()[0].dayOffset, 0);
    assert.equal((await readFollowups(tenant.id, ['veterinary', 'grooming'], { period: 'next7' })).total, 8);
    console.log('PostgreSQL pagination verified: 524 clients, 27 pages, all-scope pet search, contact filters 522/2, inclusive today contact=1, period counts=23/3/1/8.');
  }
  let failDismiss = false;
  return {
    intercept(req, res, next) {
      if (failDismiss && req.method === 'PATCH' && req.path.includes('/next-actions/')) { failDismiss = false; res.status(503).json({ error: 'No se pudo guardar el cambio de prueba.' }); return; }
      next();
    },
    async command(command) {
      if (command === 'followup-fail-once') failDismiss = true;
      if (command === 'followup-channel-off') delete process.env.WHATSAPP_ACCESS_TOKEN;
      if (command === 'followup-veterinary') await prisma.tenant.update({ where: { id: tenant.id }, data: { activeModules: ['veterinary'] } });
      if (command === 'followup-grooming') await prisma.tenant.update({ where: { id: tenant.id }, data: { activeModules: ['grooming'] } });
      if (command === 'followup-retail') await prisma.tenant.update({ where: { id: tenant.id }, data: { activeModules: ['retail'] } });
      if (command === 'followup-all') await prisma.tenant.update({ where: { id: tenant.id }, data: { activeModules: ['retail', 'veterinary', 'grooming'] } });
      if (command === 'followup-evidence') console.log('Private followup evidence: mock sends=' + mockSends + ', done=' + await prisma.petNextAction.count({ where: { tenantId: tenant.id, status: 'done' } }) + ', dismissed=' + await prisma.petNextAction.count({ where: { tenantId: tenant.id, status: 'dismissed' } }) + ', pending=' + await prisma.petNextAction.count({ where: { tenantId: tenant.id, status: 'pending' } }) + ', contacted=' + await prisma.user.count({ where: { tenantId: tenant.id, lastReminderSentAt: { not: null } } }));
    },
  };
};
