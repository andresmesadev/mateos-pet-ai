const assert = require('node:assert/strict');
const path = require('node:path');

// Real UI guide navigation followed by the existing isolated business cycles.
module.exports = function guidedSetup({ base, output, check }) {
  async function open(b) {
    await b.page.goto(base + '/dashboard');
    await b.page.getByRole('link', { name: 'Preparar mi negocio', exact: true }).click();
    await b.page.waitForURL(base + '/dashboard/settings?guide=1');
    const guide = b.page.locator('#setup-guide');
    assert.equal(await guide.evaluate(e => e.open), true);
    return guide;
  }
  async function layout(b, guide, phase) {
    for (const width of [320, 390, 768, 1440]) {
      await b.page.setViewportSize({ width, height: 1000 });
      assert(await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${b.module}: guide overflow at ${width}`);
      assert.equal(await guide.getByRole('list', { name: 'Pasos para empezar a operar' }).count(), 1);
      for (const element of await guide.locator('button, a').all()) {
        const box = await element.boundingBox(); assert(box && box.height >= 44);
      }
      if ([390, 1440].includes(width)) await b.page.screenshot({ path: path.join(output, `guide-${b.module}-${phase}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
  }
  async function start(b) {
    let guide = await open(b);
    await guide.getByText('Falta teléfono de contacto', { exact: true }).waitFor();
    assert.equal(await guide.locator('[data-setup-step]').count(), b.module === 'retail' ? 7 : 9);
    if (b.module === 'retail') {
      assert.equal(await guide.locator('[data-setup-step="services"]').count(), 0);
      assert.equal(await guide.locator('[data-setup-step="hours"]').count(), 0);
      await guide.getByText('Primera venta', { exact: true }).waitFor();
    } else {
      await guide.getByText('Faltan servicios con cita', { exact: true }).waitFor();
      await guide.getByText('Sin días de atención', { exact: true }).waitFor();
    }
    await layout(b, guide, 'new');
    await guide.getByRole('button', { name: 'Elegir áreas', exact: true }).click();
    assert.equal(await b.page.getByRole('tab', { name: 'Áreas del negocio', exact: true }).getAttribute('aria-selected'), 'true');
    await guide.getByRole('button', { name: 'Preparar equipo', exact: true }).click();
    assert.equal(await b.page.getByRole('tab', { name: 'Equipo y accesos', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await guide.locator('[data-setup-step="team"]').getByText('Por revisar', { exact: true }).count(), 1);
    await guide.getByRole('button', { name: 'Revisar datos', exact: true }).click();
    await b.page.waitForFunction(() => {
      const box = document.getElementById('settings-panel-general')?.getBoundingClientRect();
      return box && box.top >= 0 && box.top < innerHeight - 44;
    });
    const form = b.page.getByRole('form', { name: 'Datos del negocio', exact: true });
    const name = form.locator('#business-name');
    await name.fill('Borrador sin guardar');
    await guide.getByRole('link', { name: 'Preparar inventario', exact: true }).click();
    const unsaved = b.page.getByRole('dialog', { name: 'Cambios sin guardar', exact: true });
    await unsaved.getByRole('button', { name: 'Seguir editando', exact: true }).click();
    assert.equal(await name.inputValue(), 'Borrador sin guardar');
    await name.fill(b.label);
    await form.locator('#business-contact-phone').fill('5550000000');
    await b.page.route(base + '/api/proxy/dashboard/tenant/profile', route => route.fulfill({ status: 503, json: { error: 'Ensayo: conexión no disponible' } }), { times: 1 });
    await form.getByRole('button', { name: 'Guardar datos del negocio', exact: true }).click();
    await form.getByRole('alert').getByText('Ensayo: conexión no disponible', { exact: true }).waitFor();
    assert.equal(await form.locator('#business-contact-phone').inputValue(), '5550000000');
    const saved = b.page.waitForResponse(r => r.url().includes('/tenant/profile') && r.request().method() === 'PUT');
    await form.getByRole('button', { name: 'Guardar datos del negocio', exact: true }).click();
    assert.equal((await saved).status(), 200);
    await guide.getByText('Contacto guardado', { exact: true }).waitFor();
    await guide.getByRole('link', { name: 'Preparar inventario', exact: true }).click();
    await b.page.getByRole('heading', { name: 'Inventario', exact: true }).waitFor();
    guide = await open(b);
    await guide.getByRole('link', { name: 'Confirmar base', exact: true }).click();
    await b.page.getByRole('region', { name: 'Dinero base de caja', exact: true }).waitFor();
    guide = await open(b);
    if (b.module === 'retail') {
      await guide.getByRole('link', { name: 'Ir a Cobrar', exact: true }).click();
      await b.page.locator('#pos-catalog-search').waitFor();
    } else {
      await guide.getByRole('link', { name: 'Ir a Agenda', exact: true }).click();
      await b.page.getByRole('dialog').filter({ has: b.page.getByRole('heading', { name: 'Nueva cita', exact: true }) }).waitFor();
    }
    check(`${b.label}: guide opens from Home, adapts to activity, preserves unsaved edits, recovers failed save and reaches Inventory, Cash and first operation`);
  }
  async function configured(b) {
    const guide = await open(b);
    await guide.getByText('Contacto guardado', { exact: true }).waitFor();
    if (b.module !== 'retail') {
      await guide.getByText('1 servicio con cita', { exact: true }).waitFor();
      await guide.getByText('Horario guardado: revisar días', { exact: true }).waitFor();
      assert.equal(await guide.getByText('Faltan servicios con cita', { exact: true }).count(), 0);
    }
    await layout(b, guide, 'configured');
    await guide.getByRole('link', { name: 'Revisar jornada', exact: true }).click();
    await b.page.getByRole('region', { name: 'Cierre del día y comisiones', exact: true }).waitFor();
    check(`${b.label}: saved setup is reflected after reload; guide fits 320/390/768/1440 and leads to daily close`);
  }
  return { start, configured };
};
