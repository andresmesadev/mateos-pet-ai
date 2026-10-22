const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
module.exports = async ({ prisma, base, context, page, check, tenantId }) => {
  const marker = randomUUID().slice(0, 8);
  await prisma.eventType.createMany({ data: [{ name: 'ServicioActualizado', originContext: 'Servicios' }], skipDuplicates: true });
  const category = await prisma.serviceCategory.findFirst({ where: { tenantId, name: 'grooming' } }) || await prisma.serviceCategory.create({ data: { tenantId, name: 'grooming' } });
  const service = await prisma.service.create({ data: { tenantId, categoryId: category.id, name: 'Sync grooming ' + marker, duration: 20, basePrice: 40000 } });
  const owner = await prisma.user.create({ data: { tenantId, name: 'Sync owner ' + marker, phone: 'sync-' + marker } });
  const fixtures = [];
  const historical = async () => JSON.stringify(await Promise.all([
    prisma.transaction.findMany({ where: { tenantId }, include: { items: true }, orderBy: { id: 'asc' } }),
    prisma.commission.findMany({ where: { tenantId }, orderBy: { id: 'asc' } }),
  ]));
  const before = await historical();
  for (const [index, amount, fee, mode] of [[0, 42000, 18000, 'round_trip'], [1, 55000, 12000, 'pickup']]) {
    const pet = await prisma.pet.create({ data: { tenantId, ownerId: owner.id, name: `Sync pet ${index} ${marker}`, type: 'dog', defaultGroomingPrice: 70000 } });
    if (!index) await prisma.priceRule.create({ data: { serviceId: service.id, targetType: 'pet', targetId: pet.id, price: 70000, active: true } });
    const appointment = await prisma.appointment.create({ data: { tenantId, userId: owner.id, petId: pet.id, petName: pet.name, petType: 'dog', serviceType: 'grooming', serviceId: service.id, date: new Date(`2099-01-07T${index ? '17' : '16'}:00:00Z`), status: 'confirmed' } });
    const price = await context.request.patch(base + `/api/proxy/dashboard/appointments/${appointment.id}`, { data: { finalPrice: amount } });
    assert.equal(price.status(), 200, await price.text());
    const delivery = await context.request.put(base + `/api/proxy/dashboard/appointments/${appointment.id}/transport`, { data: { mode, address: 'Dirección ficticia', neighborhood: 'Barrio de prueba', amount: fee, confirmed: true } });
    assert.equal(delivery.status(), 200, await delivery.text());
    const profile = await context.request.get(base + `/api/proxy/dashboard/pets/${pet.id}/grooming-prices`);
    assert.equal(profile.status(), 200); assert.deepEqual(((p) => [p.center, p.transport, p.mode])(await profile.json()), [amount, fee, mode]);
    fixtures.push({ pet, appointment, amount, fee, mode });
  }
  check('two different pets retain their own service amount, transport fee and arrival mode after authenticated appointment saves');
  const second = fixtures[1];
  assert.equal(await prisma.priceRule.count({ where: { serviceId: service.id, targetId: second.pet.id, active: true } }), 0);
  const editedProfile = await context.request.put(base + `/api/proxy/dashboard/pets/${second.pet.id}/grooming-prices`, { data: { center: 56000, transport: 12000, mode: 'pickup' } });
  assert.equal(editedProfile.status(), 200);
  const secondQuote = await context.request.post(base + '/api/proxy/dashboard/grooming/transport/quote', { data: { petId: second.pet.id, serviceId: service.id, date: '2099-01-08T17:00:00Z', transport: { mode: 'pickup', address: 'Dirección ficticia' } } });
  assert.equal(secondQuote.status(), 200); const secondNext = (await secondQuote.json()).quote;
  assert.equal(secondNext.servicePrice, 56000); assert.equal(secondNext.transportReferencePrice, 12000);
  check('a later dossier edit remains effective for new bookings; habitual saves introduce no shadow service rule');
  const first = fixtures[0];
  await page.goto(base + '/dashboard/calendar?date=2099-01-07');
  await page.getByRole('button', { name: `${first.pet.name}, propietario ${owner.name}, servicio ${service.name}`, exact: true }).click();
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Cita de ' + first.pet.name, exact: true }) });
  await dialog.getByRole('button', { name: 'Cambiar precio', exact: true }).click();
  await dialog.getByLabel('Valor de esta cita (COP)', { exact: true }).fill('54000');
  const saved = page.waitForResponse(r => r.url().includes(`/appointments/${first.appointment.id}`) && r.request().method() === 'PATCH');
  await dialog.getByRole('button', { name: 'Guardar precio', exact: true }).click();
  assert.equal((await saved).status(), 200);
  await page.goto(base + `/dashboard/contacto?view=mascotas&pet=${first.pet.id}`);
  const profile = page.getByRole('form', { name: 'Precios de peluquería', exact: true });
  await profile.getByLabel('Valor del servicio (COP)', { exact: true }).waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('form[aria-label="Precios de peluquería"] input')].some(el => el.value === '54000'));
  assert.equal(await profile.getByLabel('Valor del domicilio (COP)', { exact: true }).inputValue(), '18000');
  assert.equal(await profile.getByLabel('¿Cómo llega habitualmente?', { exact: true }).inputValue(), 'round_trip');
  await page.reload();
  await page.waitForFunction(() => [...document.querySelectorAll('form[aria-label="Precios de peluquería"] input')].some(el => el.value === '54000'));
  const quote = await context.request.post(base + '/api/proxy/dashboard/grooming/transport/quote', { data: { petId: first.pet.id, serviceId: service.id, date: '2099-01-08T16:00:00Z', transport: { mode: 'round_trip', address: 'Dirección ficticia' } } });
  assert.equal(quote.status(), 200); const next = (await quote.json()).quote;
  assert.equal(next.servicePrice, 54000); assert.equal(next.transportReferencePrice, 18000);
  check('real Calendar price edit refreshes the pet dossier after navigation/reload and the next visit quotes the newly saved amounts');
  const snapshot = await prisma.pet.findUniqueOrThrow({ where: { id: first.pet.id } });
  const rollback = Symbol('rollback'); const afterCommit = [];
  try { await prisma.$transaction(async tx => {
    const row = await tx.appointment.findUniqueOrThrow({ where: { id: first.appointment.id }, include: { service: { include: { category: true } } } });
    await require('../backend/src/services/appointment-pet-grooming-sync.service').savePetGroomingDefaults(tx, row, { price: 12345, canPrice: true, afterCommit });
    throw rollback;
  }); } catch (error) { if (error !== rollback) throw error; }
  assert(afterCommit.length); assert.deepEqual(await prisma.pet.findUniqueOrThrow({ where: { id: first.pet.id } }), snapshot);
  assert.equal(Number((await prisma.priceRule.findFirstOrThrow({ where: { serviceId: service.id, targetId: first.pet.id, active: true } })).price), 54000);
  assert.equal(await historical(), before);
  check('rollback preserves the dossier and service agreement together; all existing payments and commissions remain unchanged');
  await prisma.appointment.update({ where: { id: first.appointment.id }, data: { status: 'completed', finalPrice: 54000 } });
  const closed = await context.request.patch(base + `/api/proxy/dashboard/appointments/${first.appointment.id}`, { data: { finalPrice: 1 } });
  assert.equal(closed.status(), 422);
  const foreign = await context.request.patch(base + '/api/proxy/dashboard/appointments/nonexistent-foreign', { data: { finalPrice: 1 } });
  assert.equal(foreign.status(), 404);
  assert.deepEqual(await prisma.pet.findUniqueOrThrow({ where: { id: first.pet.id } }), snapshot);
  check('closed and unavailable appointments cannot overwrite a dossier');
};
