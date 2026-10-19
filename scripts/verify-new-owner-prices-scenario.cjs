const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function verifyNewOwnerPrices({ prisma, base, page, context, output, check, tenantId }) {
  await page.goto(base + '/dashboard/contacto?view=clientes');
  await page.getByRole('button', { name: 'Nuevo cliente', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const form = dialog.locator('#new-owner-pets-form');
  const primary = form.getByRole('group', { name: 'Contacto del propietario', exact: true });
  for (const id of ['op-phone-alt', 'op-address', 'op-neighborhood', 'op-notes']) {
    assert.equal(await primary.locator('#' + id).isVisible(), true);
    assert.equal(await primary.locator('#' + id).evaluate(el => el.required), false);
  }
  assert.equal(await form.locator('details').count(), 0);
  const firstPrice = form.locator('input[id^="pet-groomingPrice-"]').first();
  await firstPrice.fill('0');
  await page.keyboard.press('Escape');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Seguir editando', exact: true }).click();
  assert.equal(await firstPrice.inputValue(), '0');
  const contact = { name: 'Propietario nuevo de prueba', phone: '000000008877', phoneAlt: '000000008878 / 000000008879', address: 'Dirección ficticia del alta', neighborhood: 'Barrio nuevo de prueba', notes: 'Notas ficticias del alta' };
  for (const [id, value] of Object.entries({ 'op-name': contact.name, 'op-phone': contact.phone, 'op-phone-alt': contact.phoneAlt, 'op-address': contact.address, 'op-neighborhood': contact.neighborhood, 'op-notes': contact.notes })) await primary.locator('#' + id).fill(value);
  const petNames = ['Luna alta prueba', 'Toby alta prueba', 'Mía pendiente'];
  await form.locator('input[id^="pet-name-"]').first().fill(petNames[0]);
  await form.locator('input[id^="pet-groomingTransportPrice-"]').first().fill('12000');
  await dialog.getByRole('button', { name: 'Agregar otra mascota', exact: true }).click();
  await form.locator('input[id^="pet-name-"]').nth(1).fill(petNames[1]);
  await form.locator('select[id^="pet-type-"]').nth(1).selectOption('cat');
  await form.locator('input[id^="pet-groomingPrice-"]').nth(1).fill('0');
  await dialog.getByRole('button', { name: 'Agregar otra mascota', exact: true }).click();
  await form.locator('input[id^="pet-name-"]').nth(2).fill(petNames[2]);
  const save = dialog.getByRole('button', { name: 'Crear propietario + mascota(s)', exact: true });
  const before = await prisma.user.count({ where: { tenantId } });
  await firstPrice.fill('-1');
  await save.click();
  await page.waitForFunction(() => document.activeElement?.id.startsWith('pet-groomingPrice-'));
  assert.equal(await prisma.user.count({ where: { tenantId } }), before);
  await firstPrice.fill('60000');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Registration overflow: ' + width);
  }
  await primary.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, '26-new-owner-contact-visible.png'), fullPage: true, animations: 'disabled' });
  await form.getByRole('group', { name: 'Peluquería y domicilio · Mascota 1', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, '27-new-owner-pet-prices.png'), fullPage: true, animations: 'disabled' });
  const saved = page.waitForResponse(response => response.request().method() === 'POST' && response.url().includes('/clients/with-pets'));
  await save.click();
  const response = await saved;
  assert.equal(response.status(), 201);
  const result = await response.json();
  assert.equal(result.pets.length, 3);
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: result.owner.id } });
  for (const [field, value] of Object.entries(contact)) assert.equal(owner[field], field === 'phoneAlt' ? value.replace(/\s+/g, '') : value);
  assert.equal(owner.tenantId, tenantId);
  const pets = await prisma.pet.findMany({ where: { ownerId: owner.id } });
  const prices = petNames.map(name => {
    const pet = pets.find(row => row.name === name);
    assert.equal(pet.tenantId, tenantId);
    return [pet.defaultGroomingPrice == null ? null : Number(pet.defaultGroomingPrice), pet.defaultGroomingTransportPrice == null ? null : Number(pet.defaultGroomingTransportPrice)];
  });
  assert.deepEqual(prices, [[60000, 12000], [0, null], [null, null]]);
  check('new owner form shows optional contact fields at the top, protects a price-only draft, validates negative amounts and saves three pets with distinct full/zero/pending prices');

  const ownersBeforeInvalid = await prisma.user.count({ where: { tenantId } });
  const invalid = await context.request.post(base + '/api/proxy/dashboard/clients/with-pets', { data: { name: 'Alta inválida ficticia', phone: '000000008879', pets: [
    { name: 'Válida', type: 'dog', defaultGroomingPrice: 50000 },
    { name: 'Inválida', type: 'cat', defaultGroomingTransportPrice: -1 },
  ] } });
  assert.equal(invalid.status(), 400);
  assert.equal(await prisma.user.count({ where: { tenantId } }), ownersBeforeInvalid);
  assert.equal(await prisma.pet.count({ where: { tenantId, name: { in: ['Válida', 'Inválida'] } } }), 0);
  check('an invalid second pet is rejected by the authenticated API before persisting any owner or pet');
};
