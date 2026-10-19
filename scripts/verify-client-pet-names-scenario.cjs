const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function verifyClientPets({ prisma, base, page, context, output, check, tenantId }) {
  const owner = await prisma.user.create({ data: { tenantId, name: 'Ana Pérez', phone: 'fixture-owner-a' } });
  const names = ['Luna', 'Toby', 'Mía', 'Simón', 'Nala', 'Coco', 'Nombre completo de mascota que debe acomodarse sin cortar el texto ni ocultarlo'];
  await prisma.pet.createMany({ data: names.map((name, i) => ({ tenantId, ownerId: owner.id, name, type: i % 2 ? 'dog' : 'cat' })) });
  const namesake = await prisma.user.create({ data: { tenantId, name: 'Ana Pérez', phone: 'fixture-owner-b' } });
  await prisma.pet.create({ data: { tenantId, ownerId: namesake.id, name: 'Bruno', type: 'dog' } });
  await prisma.user.create({ data: { tenantId, name: 'Cliente sin mascota', phone: 'fixture-owner-empty' } });
  const foreignOwner = await prisma.user.create({ data: { tenantId: 'legacy-clinic', name: 'Cliente ajeno', phone: 'fixture-owner-foreign' } });
  await prisma.pet.create({ data: { tenantId: 'legacy-clinic', ownerId: foreignOwner.id, name: 'Mascota ajena', type: 'dog' } });
  const response = await context.request.get(base + '/api/proxy/dashboard/clients?page=1&limit=50');
  assert.equal(response.status(), 200);
  const payload = await response.json();
  assert.equal(payload.total, 3);
  assert.equal(payload.data.find(row => row.id === owner.id).pets.length, names.length);
  assert(payload.data.every(row => row.id !== foreignOwner.id));
  assert(payload.data.every(row => row.pets.every(pet => Object.keys(pet).sort().join(',') === 'id,name,type')));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/dashboard/contacto?view=clientes');
  const table = page.getByRole('table');
  await table.waitFor();
  assert.deepEqual(await table.getByRole('columnheader').allTextContents(), ['Cliente', 'Mascotas', 'Acciones']);
  const ownerRow = table.getByRole('row').filter({ hasText: 'fixture-owner-a' });
  assert.equal(await ownerRow.getByRole('listitem').count(), names.length);
  for (const name of names) await ownerRow.getByText(name, { exact: true }).waitFor();
  await table.getByRole('row').filter({ hasText: 'fixture-owner-b' }).getByText('Bruno', { exact: true }).waitFor();
  await table.getByRole('row').filter({ hasText: 'Cliente sin mascota' }).getByText('Sin mascotas registradas', { exact: true }).waitFor();
  assert.equal(await page.getByText('Última actividad', { exact: false }).count(), 0);
  await page.screenshot({ path: path.join(output, '21-clients-pet-names-desktop.png'), fullPage: true, animations: 'disabled' });
  check('client list exposes all seven pet names, distinguishes owners with the same name, and has only Cliente/Mascotas/Acciones columns');

  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Client list overflow: ' + width);
    if (width < 1024) {
      const card = page.getByRole('article').filter({ hasText: 'fixture-owner-a' });
      assert.equal(await card.getByRole('listitem').count(), names.length);
      for (const name of names) await card.getByText(name, { exact: true }).waitFor();
    }
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.screenshot({ path: path.join(output, '22-clients-pet-names-mobile.png'), fullPage: true, animations: 'disabled' });
  const card = page.getByRole('article').filter({ hasText: 'fixture-owner-a' });
  await card.getByRole('button', { name: 'Ver cliente', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByText('Luna', { exact: true }).waitFor();
  await sheet.getByText('Toby', { exact: true }).waitFor();
  const petActions = sheet.getByRole('listitem').filter({ hasText: 'Luna' }).filter({ has: page.getByRole('button', { name: 'Ver expediente', exact: true }) }).first();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const recordButton = await petActions.getByRole('button', { name: 'Ver expediente', exact: true }).boundingBox();
    const bookingButton = await petActions.getByRole('button', { name: 'Nueva cita', exact: true }).boundingBox();
    assert(recordButton && bookingButton);
    assert(Math.abs(recordButton.height - bookingButton.height) < 1 && Math.abs(recordButton.width - bookingButton.width) < 1);
  }
  await petActions.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, '34-owner-pet-actions.png'), fullPage: true, animations: 'disabled' });
  check('client pet names wrap on mobile/tablet without horizontal overflow, preserve the empty state and open the correct owner sheet');
  await sheet.getByRole('heading', { name: 'Citas de sus mascotas', exact: true }).waitFor();
  assert.equal(await sheet.getByText('Citas del propietario', { exact: true }).count(), 0);
  const agenda = sheet.getByRole('link', { name: 'Abrir agenda de sus mascotas', exact: true });
  assert.equal(new URL(await agenda.getAttribute('href'), base).searchParams.get('client'), owner.id);
  await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
  const primary = sheet.getByRole('group', { name: 'Contacto principal', exact: true });
  const optionalFields = ['phoneAlt', 'address', 'neighborhood', 'notes'];
  for (const field of optionalFields) {
    const input = primary.locator('#edit-client-' + field);
    assert.equal(await input.isVisible(), true);
    assert.equal(await input.evaluate(el => el.required), false);
  }
  assert.equal(await sheet.locator('#edit-client-form details').count(), 0);
  await primary.locator('#edit-client-name').fill('Ana Pérez actualizada');
  const emptySaved = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/clients/' + owner.id));
  await sheet.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  assert.equal((await emptySaved).status(), 200);
  await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
  const fields = { phoneAlt: '000000009988 / 000000009989', address: 'Dirección ficticia de prueba', neighborhood: 'Barrio cliente de prueba', notes: 'Notas ficticias de prueba' };
  for (const [field, value] of Object.entries(fields)) await primary.locator('#edit-client-' + field).fill(value);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(output, '23-client-primary-contact-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await primary.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, '24-client-primary-contact-desktop.png'), fullPage: true, animations: 'disabled' });
  await page.screenshot({ path: path.join(output, '29-client-neighborhood-form-desktop.png'), fullPage: true, animations: 'disabled' });
  const contactSaved = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/clients/' + owner.id));
  await sheet.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  assert.equal((await contactSaved).status(), 200);
  const savedOwner = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
  for (const [field, value] of Object.entries(fields)) assert.equal(savedOwner[field], value);
  check('owner sheet labels appointments as pets appointments and shows all optional contact fields in the primary section, saving blank or populated values through the authenticated proxy');
  await sheet.getByText(fields.neighborhood, { exact: true }).waitFor();
  const oldUpdate = await context.request.patch(base + '/api/proxy/dashboard/clients/' + owner.id, { data: { name: 'Ana Pérez actualizada' } });
  assert.equal(oldUpdate.status(), 200);
  assert.equal((await oldUpdate.json()).neighborhood, fields.neighborhood);
  for (const neighborhood of [123, 'x'.repeat(201)]) {
    assert.equal((await context.request.patch(base + '/api/proxy/dashboard/clients/' + owner.id, { data: { neighborhood } })).status(), 400);
  }
  assert.equal((await context.request.patch(base + '/api/proxy/dashboard/clients/' + foreignOwner.id, { data: { neighborhood: 'No permitido' } })).status(), 404);
  await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
  assert.equal(await primary.locator('#edit-client-neighborhood').inputValue(), fields.neighborhood);
  await primary.locator('#edit-client-neighborhood').fill('');
  let cleared = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/clients/' + owner.id));
  await sheet.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  assert.equal((await cleared).status(), 200);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).neighborhood, null);
  await sheet.getByRole('button', { name: 'Editar', exact: true }).click();
  await primary.locator('#edit-client-neighborhood').fill(fields.neighborhood);
  await page.keyboard.press('Escape');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Seguir editando', exact: true }).click();
  assert.equal(await primary.locator('#edit-client-neighborhood').inputValue(), fields.neighborhood);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Owner neighborhood form overflow: ' + width);
  }
  await page.setViewportSize({ width: 390, height: 1000 });
  await sheet.getByRole('region', { name: 'Ubicación del propietario', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(output, '30-client-neighborhood-form-mobile.png'), fullPage: true, animations: 'disabled' });
  cleared = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/clients/' + owner.id));
  await sheet.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  assert.equal((await cleared).status(), 200);
  const restored = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
  assert.equal(restored.neighborhood, fields.neighborhood);
  assert.equal(restored.address, fields.address); assert.equal(restored.notes, fields.notes);
  check('owner neighborhood is optional, persists, clears explicitly, survives omitted legacy updates and protected drafts; invalid and foreign-tenant writes are rejected');
};
