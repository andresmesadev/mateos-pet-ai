const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

module.exports = async function verifyContracts({ prisma, base, context, page, output, check, tenantId }) {
  await prisma.eventType.createMany({ data: [{ name: 'StaffActualizado', originContext: 'Staff' }, { name: 'ServicioActualizado', originContext: 'Servicios' }], skipDuplicates: true });
  const member = await prisma.staff.create({ data: { tenantId, name: 'Profesional contrato prueba', role: 'groomer' } });
  const pet = await prisma.pet.findFirstOrThrow({ where: { tenantId, name: 'Luna' } });
  assert.equal(member.contractType, null);
  const dialog = page.getByRole('dialog');
  await page.goto(base + '/dashboard/settings?tab=localizacion');
  await page.locator('header').filter({ has: page.getByRole('heading', { name: 'Servicios y precios', exact: true }) }).getByRole('button', { name: 'Nuevo servicio', exact: true }).click();
  const checkbox = dialog.getByRole('checkbox', { name: 'Repartir este servicio por porcentaje', exact: true });
  assert.equal(await checkbox.isChecked(), false);
  await dialog.getByLabel('Nombre del servicio (obligatorio)', { exact: true }).fill('Servicio reparto de prueba');
  await dialog.getByRole('combobox').selectOption('grooming');
  await dialog.getByLabel('Duración (minutos)', { exact: true }).fill('20');
  await dialog.getByLabel('Precio base (COP)', { exact: true }).fill('100000');
  await checkbox.check();
  const created = page.waitForResponse(response => response.url().includes('/dashboard/services') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Crear servicio', exact: true }).click();
  const response = await created; assert.equal(response.status(), 201, await response.text()); const service = await response.json();
  assert.equal(service.appliesCommissionSplit, true);

  async function openContract() {
    await page.goto(base + '/dashboard/settings?tab=usuarios');
    const card = page.locator('li').filter({ has: page.getByRole('heading', { name: member.name, exact: true }) });
    await card.getByRole('button', { name: 'Tipo de contrato', exact: true }).click();
  }
  await openContract();
  await dialog.getByRole('combobox').selectOption('service');
  await dialog.getByLabel('Porcentaje para el profesional (%)', { exact: true }).fill('101');
  assert.equal(await dialog.getByRole('button', { name: 'Guardar tipo de contrato', exact: true }).isEnabled(), false);
  await dialog.getByLabel('Porcentaje para el profesional (%)', { exact: true }).fill('30');
  await dialog.getByText('70%', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  assert.equal(await dialog.getByLabel('Porcentaje para el profesional (%)', { exact: true }).inputValue(), '30');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: path.join(output, '41-staff-contract-percentage.png'), fullPage: true, animations: 'disabled' });
  const saved = page.waitForResponse(response => response.url().includes(`/staff/${member.id}/contract`) && response.request().method() === 'PUT');
  await dialog.getByRole('button', { name: 'Guardar tipo de contrato', exact: true }).click();
  assert.equal((await saved).status(), 200);
  const configured = await prisma.staff.findUniqueOrThrow({ where: { id: member.id } });
  assert.equal(configured.contractType, 'service'); assert.equal(Number(configured.commissionRate), 0.3); assert.equal(configured.role, 'groomer');
  await openContract();
  assert.equal(await dialog.getByRole('combobox').inputValue(), 'service');
  assert.equal(await dialog.getByLabel('Porcentaje para el profesional (%)', { exact: true }).inputValue(), '30');
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
  check('service defaults to Direct, checkbox opts into percentage; staff contract form saves/reopens 30/70, rejects 101 and protects drafts on mobile without changing professional role');

  const setContract = (staffId, contractType, commissionRate) => context.request.put(base + `/api/proxy/dashboard/staff/${staffId}/contract`, { data: { contractType, commissionRate } });
  async function complete(serviceId, staffId, serviceType = 'grooming') {
    const appt = await prisma.appointment.create({ data: { tenantId, userId: pet.ownerId, petId: pet.id, petName: 'Contrato de prueba', petType: pet.type, serviceId, staffId, serviceType, date: new Date(), status: 'in_progress', finalPrice: 100000 } });
    const completed = await context.request.post(base + `/api/proxy/dashboard/appointments/${appt.id}/complete`, { data: {} });
    assert.equal(completed.status(), 200, await completed.text());
    return { appt, commission: await prisma.commission.findFirstOrThrow({ where: { appointmentId: appt.id, status: 'active' } }) };
  }
  const first = await complete(service.id, member.id);
  assert.equal(Number(first.commission.splitRate), 0.3); assert.equal(Number(first.commission.staffShare), 30000); assert.equal(Number(first.commission.businessShare), 70000);
  assert.equal((await setContract(member.id, 'service', 0.4)).status(), 200);
  const second = await complete(service.id, member.id);
  assert.equal(Number(second.commission.staffShare), 40000);
  assert.deepEqual(await prisma.commission.findUniqueOrThrow({ where: { id: first.commission.id } }), first.commission);
  await openContract();
  await dialog.getByRole('combobox').selectOption('fixed');
  await dialog.getByRole('button', { name: 'Guardar tipo de contrato', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const fixed = await complete(service.id, member.id);
  assert.equal(Number(fixed.commission.staffShare), 0); assert.equal(Number(fixed.commission.businessShare), 100000);

  assert.equal((await setContract(member.id, 'service', 0.4)).status(), 200);
  await page.goto(base + '/dashboard/settings?tab=localizacion');
  const row = page.locator('li').filter({ has: page.getByRole('heading', { name: service.name, exact: true }) });
  await row.getByRole('button', { name: `Editar ${service.name}`, exact: true }).click();
  await dialog.getByRole('checkbox', { name: 'Repartir este servicio por porcentaje', exact: true }).uncheck();
  const directSaved = page.waitForResponse(response => response.url().includes(`/services/${service.id}`) && response.request().method() === 'PATCH');
  await dialog.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  assert.equal((await directSaved).status(), 200);
  const direct = await complete(service.id, member.id);
  assert.equal(Number(direct.commission.staffShare), 0);
  assert.equal(Number(direct.commission.businessShare), 100000);
  const priceEdited = await context.request.post(base + '/api/proxy/dashboard/transactions', { headers: { 'Idempotency-Key': randomUUID() }, data: { appointmentCheckout: true, appointmentId: first.appt.id, userId: pet.ownerId, petId: pet.id, paymentMethod: 'transfer', items: [{ description: 'Servicio con tasa histórica', itemKind: 'service', appointmentComponent: 'service', quantity: 1, unitPrice: 120000 }] } });
  assert.equal(priceEdited.status(), 201, await priceEdited.text());
  const corrected = await prisma.commission.findFirstOrThrow({ where: { appointmentId: first.appt.id, status: 'active' } });
  assert.equal(Number(corrected.splitRate), 0.3); assert.equal(Number(corrected.staffShare), 36000);
  assert.equal((await prisma.commission.findUniqueOrThrow({ where: { id: first.commission.id } })).status, 'voided');
  check('30% and 40% contracts, Fixed and Direct calculate correct future shares; changing both settings preserves old commission and checkout correction uses its frozen 30% through void/replacement');

  const vet = await prisma.staff.create({ data: { tenantId, name: 'Médica contrato prueba', role: 'vet' } });
  assert.equal((await setContract(vet.id, 'service', 0.4)).status(), 200);
  const vetServiceResponse = await context.request.post(base + '/api/proxy/dashboard/services', { data: { name: 'Consulta con reparto de prueba', category: 'veterinary', duration: 20, basePrice: 100000, appliesCommissionSplit: true } });
  assert.equal(vetServiceResponse.status(), 201); const vetService = await vetServiceResponse.json();
  const medical = await complete(vetService.id, vet.id, 'vet');
  assert.equal(Number(medical.commission.staffShare), 40000);
  assert.equal((await prisma.staff.findUniqueOrThrow({ where: { id: vet.id } })).role, 'vet');
  for (const data of [{}, { contractType: 'service', commissionRate: 1.1 }, { contractType: 'fixed', commissionRate: 0.3 }, { contractType: 'service', commissionRate: 0.33333 }]) {
    assert.equal((await context.request.put(base + `/api/proxy/dashboard/staff/${member.id}/contract`, { data })).status(), 400);
  }
  assert.equal((await context.request.patch(base + `/api/proxy/dashboard/services/${service.id}`, { data: { appliesCommissionSplit: 'true' } })).status(), 400);
  const foreign = await prisma.tenant.create({ data: { name: 'Contrato ajeno', slug: 'contract-foreign-' + randomUUID() } });
  const foreignMember = await prisma.staff.create({ data: { tenantId: foreign.id, name: 'Profesional ajeno', role: 'groomer' } });
  assert.equal((await context.request.put(base + `/api/proxy/dashboard/staff/${foreignMember.id}/contract`, { data: { tenantId: foreign.id, contractType: 'service', commissionRate: 1 } })).status(), 404);
  for (const data of [{ contractType: null, commissionRate: 0.4 }, { contractType: 'fixed', commissionRate: 0.4 }, { contractType: 'service', commissionRate: null }]) {
    await assert.rejects(prisma.staff.update({ where: { id: member.id }, data }));
  }
  assert.equal(Number((await prisma.staff.findUniqueOrThrow({ where: { id: member.id } })).commissionRate), 0.4);
  check('veterinarian can use a personal rate and per-service override; malformed values, foreign staff and incoherent direct database writes are rejected without changing stored contract');
};
