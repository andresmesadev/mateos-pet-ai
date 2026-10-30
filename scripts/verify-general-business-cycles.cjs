// Three independent businesses, real HTTP adapters and PostgreSQL; synthetic local data only.
// Invoked exclusively by verify-onboarding-local.cjs --general-business-cycles.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

module.exports = async function verifyBusinessCycles({ prisma, base, browser, password, output, check, reviewFixture }) {
  const { registerTenantAdministrator } = require('../backend/src/services/onboarding-registration.service');
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const evidence = [];
  const businesses = [];
  const guided = process.argv.includes('--guided-business-setup') ? require('./verify-guided-business-setup.cjs')({ base, output, check }) : null;
  const configuration = process.argv.includes('--tenant-configuration') ? require('./verify-tenant-configuration.cjs')({ prisma, base, output, check, date }) : null;
  await prisma.eventType.createMany({ data: [
    { name: 'StaffRegistrado', originContext: 'Staff' },
    { name: 'StaffActualizado', originContext: 'Staff' },
    { name: 'ServicioCreado', originContext: 'Servicios' },
    { name: 'ServicioActualizado', originContext: 'Servicios' },
    { name: 'CitaCompletada', originContext: 'Agenda' },
    { name: 'ComisiónRegistrada', originContext: 'Staff' },
    { name: 'ComisiónAnulada', originContext: 'Staff' },
    { name: 'CobroRegistrado', originContext: 'Finanzas' },
    { name: 'CobroLiquidado', originContext: 'Finanzas' },
    { name: 'CierreDíaGenerado', originContext: 'Finanzas' },
    { name: 'GastoRegistrado', originContext: 'Finanzas' },
  ], skipDuplicates: true });

  async function business(module, label) {
    const email = `${module}-${randomUUID()}@example.test`;
    const tenant = await registerTenantAdministrator({ name: label, slug: 'qa-cycle-' + randomUUID(), ownerName: 'Administrador ficticio', email, password, activeModules: [module] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await reviewFixture.guardBrowser(context);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/login');
    await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.waitForURL(base + '/dashboard');
    async function api(method, route, data, expected = 200, key) {
      const response = await context.request[method](base + '/api/proxy/dashboard' + route, {
        ...(data === undefined ? {} : { data }),
        ...(key ? { headers: { 'Idempotency-Key': key } } : {}),
      });
      const text = await response.text();
      assert.equal(response.status(), expected, `${label}: ${method} ${route}: ${text}`);
      return text ? JSON.parse(text) : null;
    }
    const access = await api('get', '/access');
    assert.deepEqual(access.activeModules, [module]);
    const b = { tenant, context, page, errors, api, module, label };
    businesses.push(b);
    if (guided) await guided.start(b);
    if (configuration) await configuration.start(b);
    const range = configuration ? configuration.hours(module) : { open: '00:00', close: '23:59' };
    const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => [d, { active: true, ...range }]));
    await api('put', '/tenant/profile', { businessHours: hours });
    await api('put', '/cash/opening', { date, amount: 40000 });
    check(`${label}: independent registration, login, single module, hours and opening cash through authenticated adapters`);
    return b;
  }
  async function product(b, name, price) {
    const key = randomUUID();
    const body = { name, internalCode: 'SAME-CODE', category: 'Demostración', presentation: 'Unidad', uses: [b.module], referenceCost: '1000', salePrice: b.module === 'retail' ? String(price) : null, stockMinimum: 1, lotPolicy: 'lot_expiry', initialStock: { quantity: 10, lotCode: 'SYNTHETIC', expiresOn: '2030-12-01' } };
    const created = await b.api('post', '/inventory/products', body, 200, key);
    const replay = await b.api('post', '/inventory/products', body, 200, key);
    assert.equal(replay.product.id, created.product.id);
    assert.equal(replay.replayed, true);
    assert.equal((await b.api('get', '/inventory/products/' + created.product.id)).physical, '10');
    return created.product;
  }
  const productLine = (p, quantity, unitPrice) => ({ productId: p.id, description: p.name, itemKind: 'product', quantity, unitPrice, priceVersion: p.priceVersion });
  async function checkout(b, body, expectedStock, p) {
    const key = randomUUID();
    const result = await b.api('post', '/transactions', body, 201, key);
    const replay = await b.api('post', '/transactions', body, 200, key);
    assert.equal(replay.id, result.id);
    assert.equal(result.total, body.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    assert.equal(result.paymentMethod, body.paymentMethod);
    if (body.paymentMethod === 'mixed') {
      assert.equal(result.cashAmount, body.cashAmount); assert.equal(result.transferAmount, body.transferAmount);
    }
    assert.equal((await b.api('get', '/inventory/products/' + p.id)).physical, String(expectedStock));
    assert.equal(await prisma.inventoryMovement.count({ where: { tenantId: b.tenant.id, productId: p.id, kind: 'sale' } }), b.module === 'retail' ? 1 : 0);
    return result;
  }
  async function consume(b, p, appt) {
    const key = randomUUID(), body = { area: b.module, appointmentId: appt.id, reason: 'Insumo ficticio de la atención', items: [{ productId: p.id, quantity: 1 }] };
    const result = await b.api('post', '/inventory/consumptions', body, 200, key);
    const replay = await b.api('post', '/inventory/consumptions', body, 200, key);
    assert.equal(replay.operationId, result.operationId);
    assert.equal((await b.api('get', '/inventory/products/' + p.id)).physical, '9');
    assert.equal(await prisma.inventoryMovement.count({ where: { tenantId: b.tenant.id, productId: p.id, kind: 'consumption' } }), 1);
  }
  async function appointment(b, category, price, rate) {
    const staff = await b.api('post', '/staff', { name: 'Profesional ficticio', role: category === 'grooming' ? 'groomer' : 'vet' }, 201);
    await b.api('put', `/staff/${staff.id}/contract`, rate == null ? { contractType: 'fixed', commissionRate: null } : { contractType: 'service', commissionRate: rate });
    const service = await b.api('post', '/services', { name: category === 'grooming' ? 'Estética demostración' : 'Consulta demostración', category, duration: 20, basePrice: price, requiresAppointment: true, appliesCommissionSplit: true }, 201);
    const ownerResult = await b.api('post', '/clients/with-pets', { name: 'Propietario ficticio', phone: '5550000000', pets: [{ name: 'Mascota demostración', type: 'dog' }] }, 201);
    const pet = await prisma.pet.findFirstOrThrow({ where: { tenantId: b.tenant.id } });
    const availability = await b.api('get', `/appointments/available-slots?dateKey=${date}&serviceId=${service.id}&staffId=${staff.id}`);
    const hour = availability.slots.find(value => value >= 10) ?? availability.slots[0];
    assert.equal(typeof hour, 'number', `${b.label}: configured business must offer a slot`);
    const appt = await b.api('post', '/appointments', { userId: pet.ownerId, petId: pet.id, serviceId: service.id, staffId: staff.id, dateKey: date, hour }, 201);
    assert(ownerResult);
    if (appt.status !== 'arrived') await b.api('patch', `/appointments/${appt.id}`, { status: 'arrived' });
    await b.api('patch', `/appointments/${appt.id}`, { status: 'in_progress' });
    await b.api('post', `/appointments/${appt.id}/complete`, {});
    return { appt, pet, staff, service };
  }
  async function close(b, income, share, transaction, p, expectedStock) {
    if (guided) await guided.configured(b);
    await b.api('post', '/expenses', { amount: 5000, category: 'other', description: 'Gasto ficticio', responsible: 'Administrador ficticio', paymentMethod: 'cash' }, 201);
    const snapshot = await b.api('post', '/daily-close', { date, expectedOpeningCashAmount: 40000, retainedCashAmount: 20000 }, 201);
    assert.equal(snapshot.incomeTotal, income);
    assert.equal(snapshot.expenseTotal, 5000);
    assert.equal(snapshot.netAmount, income - 5000);
    assert.equal(snapshot.openingCashAmount, 40000);
    assert.equal(snapshot.retainedCashAmount, 20000);
    assert.equal(snapshot.staffBreakdown.reduce((sum, row) => sum + Number(row.staffShare), 0), share);
    const history = await b.api('get', `/financial-history?from=${date}&to=${date}`);
    assert.equal(history.days[0].staffCommissionTotal, share);
    assert.equal(history.days[0].netAfterCommissions, income - 5000 - share);
    await b.api('post', '/daily-close', { date }, 409);
    await b.api('put', '/cash/opening', { date, amount: 1 }, 409);
    const tomorrow = new Date(date + 'T12:00:00Z'); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    // Future openings are intentionally rejected by the HTTP adapter. Verify
    // carry-over with its real repository without advancing the machine clock.
    await b.api('get', '/cash/opening?date=' + tomorrow.toISOString().slice(0, 10), undefined, 400);
    const { PrismaCashOpeningRepository } = require('../backend/src/contexts/finance/infrastructure/persistence/prisma-cash-opening.repository');
    const suggestion = await new PrismaCashOpeningRepository().previousSuggestion(b.tenant.id, new Date(tomorrow.toISOString().slice(0, 10) + 'T00:00:00Z'));
    assert.equal(suggestion.amount, 20000);
    await b.page.goto(base + '/dashboard/pos?tab=caja&date=' + date);
    await b.page.getByRole('button', { name: 'Día cerrado', exact: true }).waitFor();
    for (const width of [390, 1440]) {
      await b.page.setViewportSize({ width, height: 1000 });
      assert(await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${b.label}: overflow ${width}`);
      await b.page.screenshot({ path: path.join(output, `${b.module}-closed-${width}.png`), fullPage: true, animations: 'disabled' });
    }
    await b.page.reload();
    await b.page.getByRole('button', { name: 'Día cerrado', exact: true }).waitFor();
    assert.equal((await b.api('get', '/inventory/products/' + p.id)).physical, String(expectedStock));
    const stored = await prisma.transaction.findUniqueOrThrow({ where: { id: transaction.id }, include: { items: true } });
    assert.equal(stored.status, 'active'); assert(stored.paidAt);
    if (configuration) await configuration.closed(b, p);
    evidence.push({ business: b.label, modules: [b.module], income, expense: 5000, commission: share, balanceAfterReserve: income - 5000 - share, opening: 40000, retained: 20000, stock: expectedStock, samplePaymentMethod: stored.paymentMethod, sampleCashAmount: stored.cashAmount == null ? null : Number(stored.cashAmount), sampleTransferAmount: stored.transferAmount == null ? null : Number(stored.transferAmount) });
    check(`${b.label}: stock ${expectedStock}, income ${income}, commission ${share}; official close, report, retained cash, duplicate protection and mobile/desktop persistence agree`);
  }
  try {
    const vet = await business('veterinary', 'Clínica exclusiva de demostración');
    const vaccine = await product(vet, 'Vacuna demostración', 50000);
    const consultation = await appointment(vet, 'veterinary', 80000, null);
    await consume(vet, vaccine, consultation.appt);
    const medicalSale = await checkout(vet, { appointmentCheckout: true, appointmentId: consultation.appt.id, userId: consultation.pet.ownerId, petId: consultation.pet.id, paymentMethod: 'transfer', items: [
      { description: consultation.service.name, itemKind: 'service', appointmentComponent: 'service', quantity: 1, unitPrice: 80000 },
    ] }, 9, vaccine);
    await close(vet, 80000, 0, medicalSale, vaccine, 9);

    const grooming = await business('grooming', 'Estética exclusiva de demostración');
    const shampoo = await product(grooming, 'Producto estética demostración', 20000);
    const styling = await appointment(grooming, 'grooming', 90000, 0.3);
    await consume(grooming, shampoo, styling.appt);
    const direct = await grooming.api('post', '/services', { name: 'Complemento directo', category: 'grooming', duration: 10, basePrice: 10000, requiresAppointment: false, appliesCommissionSplit: false }, 201);
    const stylingSale = await checkout(grooming, { appointmentCheckout: true, appointmentId: styling.appt.id, userId: styling.pet.ownerId, petId: styling.pet.id, paymentMethod: 'mixed', cashAmount: 50000, transferAmount: 50000, items: [
      { description: styling.service.name, itemKind: 'service', appointmentComponent: 'service', quantity: 1, unitPrice: 90000 },
      { description: direct.name, serviceId: direct.id, itemKind: 'service', quantity: 1, unitPrice: 10000 },
    ] }, 9, shampoo);
    const commission = await prisma.commission.findFirstOrThrow({ where: { tenantId: grooming.tenant.id, appointmentId: styling.appt.id, status: 'active' } });
    assert.equal(Number(commission.splitRate), 0.3); assert.equal(Number(commission.staffShare), 27000);
    await grooming.api('put', `/staff/${styling.staff.id}/contract`, { contractType: 'service', commissionRate: 0.4 });
    assert.deepEqual(await prisma.commission.findUniqueOrThrow({ where: { id: commission.id } }), commission);
    assert.equal(await prisma.commission.count({ where: { tenantId: grooming.tenant.id, serviceId: direct.id, status: 'active' } }), 0);
    const futureSale = await checkout(grooming, { paymentMethod: 'cash', items: [
      { description: styling.service.name, serviceId: styling.service.id, performedByStaffId: styling.staff.id, itemKind: 'service', quantity: 1, unitPrice: 40000 },
    ] }, 9, shampoo);
    const futureCommission = await prisma.commission.findFirstOrThrow({ where: { tenantId: grooming.tenant.id, transactionItem: { transactionId: futureSale.id }, status: 'active' } });
    assert.equal(Number(futureCommission.splitRate), 0.4); assert.equal(Number(futureCommission.staffShare), 16000);
    assert.deepEqual(await prisma.commission.findUniqueOrThrow({ where: { id: commission.id } }), commission);
    check('grooming: future 40/60 generates 16000 on 40000; original 30/70 stays immutable and Direct generates no commission');
    await close(grooming, 140000, 43000, stylingSale, shampoo, 9);

    const shop = await business('retail', 'Pet shop exclusivo de demostración');
    const food = await product(shop, 'Alimento demostración', 25000);
    const sale = await checkout(shop, { paymentMethod: 'mixed', cashAmount: 20000, transferAmount: 30000, items: [productLine(food, 2, 25000)] }, 8, food);
    assert.equal(await prisma.appointment.count({ where: { tenantId: shop.tenant.id } }), 0);
    assert.equal(await prisma.commission.count({ where: { tenantId: shop.tenant.id } }), 0);
    await close(shop, 50000, 0, sale, food, 8);
    const completedType = await prisma.eventType.findUniqueOrThrow({ where: { name: 'CitaCompletada' } });
    const events = await prisma.domainEvent.findMany({ where: { tenantId: { in: businesses.map(b => b.tenant.id) }, eventTypeId: completedType.id } });
    assert.equal(events.length, 2);
    for (const event of events) {
      const deliveries = await prisma.eventDelivery.findMany({ where: { domainEventId: event.id, consumer: 'Automatizaciones' } });
      assert.equal(deliveries.length, 1); assert.equal(deliveries[0].status, 'delivered');
    }
    // Reproduce the original visibility failure using the real event reactor,
    // then prove both records roll back together rather than leaving an orphan.
    const { events: eventContext } = require('../backend/src/contexts');
    let rollbackEvent;
    await assert.rejects(prisma.$transaction(async tx => {
      const result = await eventContext.registerDomainEvent({ tenantId: vet.tenant.id, eventTypeName: 'CitaCompletada', payload: { synthetic: true }, origin: 'General business cycle regression' }, { tx });
      rollbackEvent = result.domainEvent.id;
      assert.equal(await tx.eventDelivery.count({ where: { domainEventId: rollbackEvent, status: 'delivered' } }), 1);
      throw new Error('expected synthetic rollback');
    }), /expected synthetic rollback/);
    assert.equal(await prisma.domainEvent.count({ where: { id: rollbackEvent } }), 0);
    assert.equal(await prisma.eventDelivery.count({ where: { domainEventId: rollbackEvent } }), 0);
    check('appointment events have one successful delivery; event and delivery share the transaction and roll back together');
    if (process.argv.includes('--service-visibility')) await require('./verify-service-visibility.cjs')({ prisma, base, businesses, output, check });
    for (const b of businesses) {
      for (const other of businesses.filter(x => x !== b)) {
        const foreign = await prisma.inventoryProduct.findFirstOrThrow({ where: { tenantId: other.tenant.id } });
        await b.api('get', '/inventory/products/' + foreign.id, undefined, 404);
      }
      assert.deepEqual(b.errors, []);
    }
    assert.deepEqual(reviewFixture.blockedBrowserRequests, []);
    fs.writeFileSync(path.join(output, 'business-cycles.json'), JSON.stringify({ date, evidence, isolationChecks: 6, pageErrors: 0 }, null, 2));
    check('three independent tenants reuse the same product code without crossing data; zero browser errors or external requests');
    return businesses.map(b => ({ tenantId: b.tenant.id, module: b.module, label: b.label }));
  } finally {
    for (const b of businesses) await b.context.close();
  }
};
