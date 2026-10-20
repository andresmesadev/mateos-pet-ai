const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
module.exports = async function ({ prisma, base, context, page, output, check, tenantId }) {
  const category = await prisma.serviceCategory.findFirstOrThrow({ where: { tenantId, name: 'grooming' } });
  const professional = await prisma.staff.create({ data: { tenantId, name: 'Profesional de adicionales', role: 'groomer', contractType: 'service', commissionRate: .5 } });
  const extra = await prisma.service.create({ data: { tenantId, categoryId: category.id, name: 'Desenredada adicional prueba', requiresAppointment: false, appliesCommissionSplit: true, basePrice: 28000 } });
  const nails = await prisma.service.create({ data: { tenantId, categoryId: category.id, name: 'Uñas adicional prueba', requiresAppointment: false, appliesCommissionSplit: true, basePrice: 8000 } });
  const direct = await prisma.service.create({ data: { tenantId, categoryId: category.id, name: 'Directo adicional prueba', requiresAppointment: false, appliesCommissionSplit: false, basePrice: 36000 } });
  await page.goto(base + '/dashboard/pos?tab=venta');
  await page.getByRole('button', { name: 'Servicios', exact: true }).click();
  for (const service of [extra, nails, direct]) {
    const search = page.getByRole('textbox', { name: 'Buscar servicio del catálogo', exact: true });
    await search.fill(service.name);
    const panel = search.locator('xpath=ancestor::section[1]');
    await panel.getByRole('button').filter({ hasText: service.name }).click();
    if (service.appliesCommissionSplit) await page.getByRole('combobox', { name: new RegExp('Profesional de ' + service.name) }).selectOption(professional.id);
  }
  for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 1000 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
  await page.screenshot({ path: path.join(output, '42-extra-service-professional.png'), animations: 'disabled', fullPage: true });
  await page.getByRole('button', { name: 'Transferencia', exact: true }).click();
  const paidResponse = page.waitForResponse(r => r.url().includes('/dashboard/transactions') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirmar cobro', exact: true }).click();
  const paid = await paidResponse; assert.equal(paid.status(), 201, await paid.text()); const receipt = await paid.json();
  const rows = await prisma.commission.findMany({ where: { tenantId, staffId: professional.id, status: 'active' } });
  assert.equal(rows.length, 2); assert.equal(rows.reduce((sum, c) => sum + Number(c.staffShare), 0), 18000);
  assert(rows.every(c => c.appointmentId === null && c.transactionItemId));
  const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: receipt.id }, include: { items: true } });
  assert.equal(stored.items.find(i => i.serviceId === extra.id).performedByStaffId, professional.id);
  assert.equal(stored.items.find(i => i.serviceId === direct.id).performedByStaffId, null);
  check('POS catalogue preserves service identity; additional services select their professional, fit mobile, freeze 14000 + 4000 and exclude the direct line');

  const headers = { 'Idempotency-Key': randomUUID() };
  const invalid = await context.request.post(base + '/api/proxy/dashboard/transactions', { headers, data: { paymentMethod: 'transfer', items: [{ description: extra.name, itemKind: 'service', serviceId: extra.id, quantity: 1, unitPrice: 28000 }] } });
  assert.equal(invalid.status(), 422);
  assert.equal(await prisma.transaction.count({ where: { tenantId, items: { some: { serviceId: extra.id } } } }), 1);
  const reversed = await context.request.post(base + `/api/proxy/dashboard/transactions/${receipt.id}/void`, { data: { reason: 'Prueba aislada de anulación de comisiones adicionales' } });
  assert.equal(reversed.status(), 200, await reversed.text());
  assert.equal(await prisma.commission.count({ where: { tenantId, staffId: professional.id, status: 'active' } }), 0);
  assert.equal(await prisma.commission.count({ where: { tenantId, staffId: professional.id, status: 'voided' } }), 2);
  const voidEvents = await prisma.domainEvent.findMany({ where: { tenantId, eventType: { name: 'ComisiónAnulada' }, payload: { path: ['commission', 'staffId'], equals: professional.id } } });
  assert.equal(voidEvents.length, 2); assert(voidEvents.every(event => event.origin === 'Staff'));
  check('missing professional rolls back the entire payment; voiding a service sale atomically voids its two commissions');

  const legacy = await prisma.transaction.create({ data: { tenantId, origin: 'manual_pos_sale', total: 36000, paidAt: new Date(), paymentMethod: 'transfer', items: { create: [{ description: 'Histórica desenredada', itemKind: 'service', quantity: 1, unitPrice: 28000, total: 28000 }, { description: 'Histórica uñas', itemKind: 'service', quantity: 1, unitPrice: 8000, total: 8000 }] } }, include: { items: true } });
  const { recordSaleServiceCommission } = require('../backend/src/contexts/staff');
  const command = index => ({ tenantId, transactionItemId: legacy.items[index].id, serviceId: index ? nails.id : extra.id, staffId: professional.id, historicalReason: 'Responsable confirmó que ambos servicios fueron realizados por este profesional.' });
  await Promise.all([recordSaleServiceCommission(command(0)), recordSaleServiceCommission(command(0))]);
  await recordSaleServiceCommission(command(1));
  assert.equal(await prisma.commission.count({ where: { tenantId, staffId: professional.id, status: 'active' } }), 2);
  const restored = await prisma.commission.aggregate({ where: { tenantId, staffId: professional.id, status: 'active' }, _sum: { staffShare: true } }); assert.equal(Number(restored._sum.staffShare), 18000);
  assert.deepEqual(await prisma.transaction.findUniqueOrThrow({ where: { id: legacy.id }, include: { items: true } }), legacy);
  const active = await prisma.commission.findFirstOrThrow({ where: { tenantId, staffId: professional.id, status: 'active' } });
  await assert.rejects(prisma.commission.create({ data: { ...active, id: randomUUID() } }));
  check('explicit historical attribution adds exactly 18000, concurrent retries do not duplicate it and the receipt remains byte-for-byte unchanged');
  const veterinary = await prisma.serviceCategory.findFirstOrThrow({ where: { tenantId, name: 'veterinary' } });
  const consultation = await prisma.service.create({ data: { tenantId, categoryId: veterinary.id, name: 'Consulta directa con uñas', duration: 20, basePrice: 68000, appliesCommissionSplit: false } });
  const vet = await prisma.staff.create({ data: { tenantId, name: 'Veterinaria consulta mixta', role: 'vet', contractType: 'fixed' } });
  const pet = await prisma.pet.findFirstOrThrow({ where: { tenantId, name: 'Luna' } });
  const appointment = await prisma.appointment.create({ data: { tenantId, userId: pet.ownerId, petId: pet.id, petName: pet.name, petType: pet.type, serviceId: consultation.id, staffId: vet.id, serviceType: 'vet', date: new Date(), status: 'in_progress', finalPrice: 68000 } });
  const completed = await context.request.post(base + `/api/proxy/dashboard/appointments/${appointment.id}/complete`, { data: {} }); assert.equal(completed.status(), 200, await completed.text());
  const key = randomUUID(), body = { appointmentCheckout: true, appointmentId: appointment.id, userId: pet.ownerId, petId: pet.id, paymentMethod: 'transfer', items: [{ description: consultation.name, appointmentComponent: 'service', itemKind: 'service', quantity: 1, unitPrice: 68000 }, { description: nails.name, serviceId: nails.id, performedByStaffId: professional.id, itemKind: 'service', quantity: 1, unitPrice: 8000 }] };
  const mixture = await context.request.post(base + '/api/proxy/dashboard/transactions', { headers: { 'Idempotency-Key': key }, data: body }); assert.equal(mixture.status(), 201, await mixture.text()); const mixReceipt = await mixture.json();
  const replay = await context.request.post(base + '/api/proxy/dashboard/transactions', { headers: { 'Idempotency-Key': key }, data: body }); assert.equal(replay.status(), 200); assert.equal((await replay.json()).id, mixReceipt.id);
  const mixExtra = await prisma.commission.findMany({ where: { transactionItem: { transactionId: mixReceipt.id }, status: 'active' } }); assert.equal(mixExtra.length, 1); assert.equal(Number(mixExtra[0].staffShare), 4000); assert.equal(mixExtra[0].staffId, professional.id);
  const main = await prisma.commission.findFirstOrThrow({ where: { appointmentId: appointment.id, status: 'active' } }); assert.equal(Number(main.staffShare), 0); assert.equal(Number(main.businessShare), 68000);
  await prisma.staff.update({ where: { id: professional.id }, data: { commissionRate: .3333 } });
  const precise = await context.request.post(base + '/api/proxy/dashboard/transactions', { headers: { 'Idempotency-Key': randomUUID() }, data: { paymentMethod: 'transfer', items: [{ description: extra.name, serviceId: extra.id, performedByStaffId: professional.id, itemKind: 'service', quantity: 2, unitPrice: 28000 }] } }); assert.equal(precise.status(), 201, await precise.text());
  const preciseCommission = await prisma.commission.findFirstOrThrow({ where: { transactionItem: { transactionId: (await precise.json()).id }, status: 'active' } }); assert.equal(Number(preciseCommission.splitRate), .3333); assert.equal(Number(preciseCommission.staffShare), 18664.8);
  check('mixed appointment keeps consultation 100% for clinic and pays nails 4000 to groomer only once; quantities and 33.33% retain exact PostgreSQL precision');
  const race = await prisma.transaction.create({ data: { tenantId, origin: 'manual_pos_sale', total: 8000, paidAt: new Date(), paymentMethod: 'transfer', items: { create: [{ description: 'Uñas histórica concurrencia', itemKind: 'service', quantity: 1, unitPrice: 8000, total: 8000 }] } }, include: { items: true } });
  const outcomes = await Promise.allSettled([
    recordSaleServiceCommission({ tenantId, transactionItemId: race.items[0].id, serviceId: nails.id, staffId: professional.id, historicalReason: 'Prueba concurrente aislada confirmada' }),
    context.request.post(base + `/api/proxy/dashboard/transactions/${race.id}/void`, { data: { reason: 'Anulación concurrente de prueba' } })
  ]);
  const voidOutcome = outcomes[1]; assert.equal(voidOutcome.status, 'fulfilled'); assert.equal(voidOutcome.value.status(), 200, await voidOutcome.value.text());
  assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: race.id } })).status, 'voided');
  assert.equal(await prisma.commission.count({ where: { transactionItemId: race.items[0].id, status: 'active' } }), 0);
  check('concurrent historical attribution and sale void cannot leave an active commission on a voided receipt');
};
