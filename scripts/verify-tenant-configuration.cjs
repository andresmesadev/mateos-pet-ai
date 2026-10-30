const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = function tenantConfiguration({ prisma, base, output, check, date }) {
  const identities = {
    veterinary: { contactPhone: '5550700101', address: 'Dirección clínica de demostración', technicalPhone: '999000000000101', open: '09:30', close: '13:45' },
    grooming: { contactPhone: '5550700202', address: 'Dirección estética de demostración', technicalPhone: '999000000000202', open: '08:30', close: '12:50' },
    retail: { contactPhone: '5550700303', address: 'Dirección tienda de demostración', technicalPhone: '999000000000303', open: '07:15', close: '16:35' },
  };
  const matrix = [];
  const hours = module => ({ open: identities[module].open, close: identities[module].close });
  async function start(b) {
    const profile = await b.api('get', '/tenant/profile');
    assert.equal(profile.name, b.label); assert.equal(profile.phone, null);
    assert.equal(profile.contactPhone, null);
    assert.deepEqual(await b.api('get', '/services'), []);
    assert.deepEqual((await b.api('get', '/inventory/products')).data, []);
    const roster = await b.api('get', '/staff'); assert.equal(roster.length, 1); assert.equal(roster[0].role, 'admin');
    assert.equal(await prisma.user.count({ where: { tenantId: b.tenant.id } }), 0);
    assert.equal(Object.keys(profile.businessHours).length, 7);
    assert(Object.values(profile.businessHours).every(day => day.active === false && day.open === '' && day.close === ''));
    if (b.module !== 'retail') {
      const { isSlotAvailable } = require('../backend/src/services/availability-db.service');
      assert.equal(await isSlotAvailable({ dateKey: date, hour: 11, serviceType: b.module === 'veterinary' ? 'vet' : 'grooming', tenantId: b.tenant.id, manual: true }), false);
    }
    const identity = identities[b.module];
    await b.api('put', '/tenant/profile', { contactPhone: identity.contactPhone, address: identity.address });
    // This is a deliberately different synthetic channel identifier, not a
    // connected number. Providers stay disabled throughout the fixture.
    await prisma.tenant.update({ where: { id: b.tenant.id }, data: { phone: identity.technicalPhone } });
    check(`${b.label}: fresh account has only its administrator, no inherited catalog/stock/clients/contact and no legacy opening hours`);
  }
  async function closed(b, product) {
    const identity = identities[b.module];
    const profile = await b.api('get', '/tenant/profile');
    assert.equal(profile.contactPhone, identity.contactPhone);
    assert.equal(profile.address, identity.address);
    assert.equal(profile.businessHours.mon.open, identity.open);
    assert.equal(profile.businessHours.mon.close, identity.close);
    const reply = await require('../backend/src/services/conversation.service').generateReply({ analysis: { intent: 'ask_info' }, session: {}, semanticContext: '', userMessage: '¿Cuál es el horario de atención?' }, { tenantId: b.tenant.id });
    assert(reply.reply.includes(identity.open + '–' + identity.close));
    const ownLabel = { veterinary: 'Veterinaria:', grooming: 'Peluquería:', retail: 'Pet shop:' }[b.module];
    assert(reply.reply.includes(ownLabel));
    for (const label of ['Veterinaria:', 'Peluquería:', 'Pet shop:'].filter(label => label !== ownLabel)) assert(!reply.reply.includes(label));
    const summary = await b.api('get', '/reports/summary?period=month&offset=0');
    assert.equal(summary.establishment.id, b.tenant.id); assert.equal(summary.establishment.name, b.label);
    assert.equal(summary.revenue.value, { veterinary: 80000, grooming: 140000, retail: 50000 }[b.module]);
    assert.deepEqual((await b.api('get', '/inventory/products')).data.map(row => row.id), [product.id]);
    const before = JSON.stringify(await prisma.transaction.findMany({ where: { tenantId: b.tenant.id }, include: { items: true }, orderBy: { id: 'asc' } }));
    await b.page.goto(base + '/dashboard/pos?tab=historial');
    await b.page.getByRole('button', { name: 'Comprobante', exact: true }).first().waitFor();
    if (b.module !== 'retail') {
      await b.page.route('**/api/proxy/dashboard/tenant/profile?tenantId=' + b.tenant.id, route => route.fulfill(b.module === 'veterinary' ? { status: 503, json: { error: 'Synthetic profile outage' } } : { json: { id: 'foreign-business', name: 'FOREIGN-ISSUER', contactPhone: 'FOREIGN-CONTACT' } }), { times: 1 });
    }
    await b.page.getByRole('button', { name: 'Comprobante', exact: true }).first().click();
    const dialog = b.page.getByRole('dialog', { name: 'Detalle de operación', exact: true });
    if (b.module !== 'retail') {
      await dialog.getByRole('alert').waitFor();
      assert.equal(await dialog.getByRole('button', { name: 'Imprimir', exact: true }).isEnabled(), false);
      assert.equal(await b.page.locator('[data-pos-print]').count(), 0);
      assert(!(await dialog.innerText()).includes('FOREIGN-ISSUER'));
      await dialog.getByRole('button', { name: 'Reintentar establecimiento', exact: true }).click();
    }
    const issuer = dialog.locator('header[aria-label="Establecimiento del comprobante"]');
    await issuer.getByText(b.label, { exact: true }).waitFor();
    await issuer.getByText(identity.contactPhone, { exact: true }).waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Imprimir', exact: true }).isEnabled(), true);
    const body = await dialog.innerText();
    assert(!body.includes(identity.technicalPhone)); assert(!body.includes('Mateos Pet'));
    for (const other of Object.values(identities).filter(row => row !== identity)) assert(!body.includes(other.contactPhone) && !body.includes(other.address));
    for (const width of [390, 1440]) {
      await b.page.setViewportSize({ width, height: 1000 });
      assert(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth));
      await b.page.screenshot({ path: path.join(output, `receipt-${b.module}-${width}.png`), animations: 'disabled' });
    }
    await b.page.emulateMedia({ media: 'print' });
    const printed = b.page.locator('[data-pos-print]');
    assert(await printed.isVisible());
    assert((await printed.innerText()).includes(b.label)); assert((await printed.innerText()).includes(identity.contactPhone));
    assert(!(await printed.innerText()).includes(identity.technicalPhone));
    await b.page.screenshot({ path: path.join(output, `receipt-${b.module}-print.png`), fullPage: true, animations: 'disabled' });
    await b.page.emulateMedia({ media: 'screen' });
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    assert.equal(JSON.stringify(await prisma.transaction.findMany({ where: { tenantId: b.tenant.id }, include: { items: true }, orderBy: { id: 'asc' } })), before);
    if (b.module !== 'retail') {
      const pet = await prisma.pet.findFirstOrThrow({ where: { tenantId: b.tenant.id } });
      const report = await b.api('get', `/pets/${pet.id}/report`);
      assert.equal(report.tenant.name, b.label); assert.equal(report.tenant.contactPhone, identity.contactPhone);
      assert.equal(Object.hasOwn(report.tenant, 'phone'), false);
      await b.page.addInitScript(() => { window.print = () => {}; });
      await b.page.goto(base + `/print/pets/${pet.id}`);
      await b.page.getByText(identity.contactPhone, { exact: true }).waitFor();
      assert(!(await b.page.locator('body').innerText()).includes(identity.technicalPhone));
    }
    matrix.push({ module: b.module, ownIssuer: true, distinctHours: hours(b.module), contactMatches: true, technicalPhoneHidden: true, reportIncomeMatches: true });
    fs.writeFileSync(path.join(output, 'configuration-matrix.json'), JSON.stringify(matrix, null, 2));
    check(`${b.label}: own issuer/contact in screen and print, own hours and active-area message, scoped report/catalog, no technical WhatsApp ID; receipt recovery leaves money unchanged`);
  }
  return { start, closed, hours };
};
