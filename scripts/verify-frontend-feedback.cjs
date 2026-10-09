// Focused scenarios; reuse the authenticated, in-memory API fixture from
// verify-general-dashboard.cjs --feedback-only. No real data or external messages.
const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function verify({ login, origin, errors, directory, calls, control }) {
  let scenarios = 0;
  const pendingReleases = [];
  const { context, page } = await login('admin', 320);
  const url = route => origin + '/dashboard/' + route + (route.includes('?') ? '&' : '?') + 'tenant=fixture-selected';
  const submitOwner = () => page.locator('button[form="new-owner-pets-form"]').click();
  const submitPet = () => page.locator('button[form="new-pet-form"]').click();
  const countWrites = () => calls.filter(call => call.method !== 'GET').length;
  const focused = id => page.waitForFunction(id => document.activeElement?.id === id, id);
  const noOverflow = async () => {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const clipped = await page.locator('[role="dialog"] button').evaluateAll(buttons => buttons.filter(button => {
      const box = button.getBoundingClientRect();
      return box.width && box.height && (box.left < -1 || box.right > innerWidth + 1);
    }).map(button => button.textContent));
    assert.deepEqual(clipped, [], 'Dialog actions must remain inside the viewport');
  };
  try {
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url('contacto'), { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Nuevo cliente', exact: true }).click();
      const before = countWrites();
      await submitOwner(); await focused('op-name');
      for (const id of ['op-name', 'op-phone']) {
        assert.equal(await page.locator('#' + id).getAttribute('aria-invalid'), 'true');
        await page.locator('#' + id + '-error').waitFor();
      }
      assert.equal(await page.locator('input[id^="pet-name-"][aria-invalid="true"]').count(), 1);
      await page.locator('#op-name').fill('María Prueba');
      await submitOwner(); await focused('op-phone');
      assert.equal(await page.locator('#op-name-error').count(), 0);
      await page.locator('#op-phone').fill('0000000002');
      await submitOwner(); await page.waitForFunction(() => document.activeElement?.id.startsWith('pet-name-'));
      await page.locator('input[id^="pet-name-"]').fill('Luna Prueba');
      await page.locator('#new-owner-pets-form summary').click();
      await page.locator('#op-email').fill('correo-incompleto');
      await page.locator('#new-owner-pets-form summary').click();
      await submitOwner(); await focused('op-email');
      assert.equal(await page.locator('#new-owner-pets-form details').getAttribute('open'), '');
      assert.match(await page.locator('#op-email-error').innerText(), /correo válido/);
      await page.locator('#op-email').fill('prueba@fixture.invalid');
      await page.getByRole('button', { name: 'Agregar otra mascota' }).click();
      await submitOwner();
      const second = page.locator('input[id^="pet-name-"]').nth(1);
      await focused(await second.getAttribute('id'));
      await page.getByRole('button', { name: 'Quitar mascota 2' }).click();
      assert.equal(countWrites(), before, 'Invalid fields must not reach the API');
      await page.locator('input[id^="pet-weight-"]').fill('-1');
      await submitOwner(); await page.waitForFunction(() => document.activeElement?.id.startsWith('pet-weight-'));
      assert.match(await page.locator('p[id^="pet-weight-"]').innerText(), /mayor que 0/);
      await page.locator('input[id^="pet-weight-"]').fill('12.5');
      await page.screenshot({ path: path.join(directory, `feedback-fields-${width}.png`), fullPage: true });
      await noOverflow();
      control.registration(true);
      await submitOwner();
      const alert = page.locator('#new-owner-pets-form').getByRole('alert');
      await alert.waitFor(); await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'alert');
      assert.match(await alert.innerText(), /registro de prueba/);
      assert.equal(await page.locator('#op-name').inputValue(), 'María Prueba');
      assert.equal(await page.locator('input[id^="pet-name-"]').inputValue(), 'Luna Prueba');
      await page.waitForTimeout(1000); assert.equal(await alert.isVisible(), true);
      await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click();
      await page.getByRole('alertdialog').waitFor();
      await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
      assert.equal(await page.locator('#op-email').inputValue(), 'prueba@fixture.invalid');
      await noOverflow();
      await page.screenshot({ path: path.join(directory, `feedback-save-error-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click();
      await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
      control.registration(false);
      scenarios += 4;
      console.log(`PASS: ${width}px required fields, email/weight, dynamic pets, error focus, persistent failure and protected draft; no invalid writes or overflow.`);
    }

    // A slow response prevents a second submission and closes only on success.
    await page.goto(url('contacto'), { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Nuevo cliente', exact: true }).click();
    await page.locator('#op-name').fill('Ana Guardada'); await page.locator('#op-phone').fill('0000000003');
    await page.locator('input[id^="pet-name-"]').fill('Toby Guardado');
    let release;
    control.registrationGate(new Promise(resolve => { release = resolve; }));
    pendingReleases.push(release);
    const beforeSave = countWrites();
    await submitOwner();
    await page.waitForFunction(() => document.querySelector('button[form="new-owner-pets-form"]')?.disabled);
    assert.equal(await page.locator('#op-name').isDisabled(), true);
    assert.equal(await page.locator('#new-owner-pets-form').getAttribute('aria-busy'), 'true');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#op-name').isVisible(), true);
    release(); control.registrationGate(null);
    await page.getByRole('heading', { name: 'Nuevo propietario + mascota(s)' }).waitFor({ state: 'hidden' });
    assert.equal(countWrites(), beforeSave + 1);
    scenarios++;
    console.log('PASS: one submission while saving; fields and Escape protected; successful retry closes registration.');

    await page.goto(url('calendar?new=1'), { waitUntil: 'networkidle' });
    await page.locator('#appointment-client').fill('Ana Guardada');
    await page.getByRole('button', { name: /Ana Guardada/ }).first().click();
    await page.getByRole('button', { name: 'Agregar mascota a este cliente' }).click();
    const beforePet = countWrites();
    await submitPet(); await focused('np-name');
    await page.locator('#np-name-error').waitFor(); assert.equal(countWrites(), beforePet);
    assert.equal(await page.locator('#np-owner-phone').inputValue(), '0000000003');
    await page.locator('#np-name').fill('Nala Guardada');
    control.pet(true); await submitPet();
    await page.locator('#new-pet-form').getByRole('alert').waitFor();
    assert.equal(await page.locator('#np-name').inputValue(), 'Nala Guardada');
    control.pet(false); await submitPet();
    await page.getByRole('heading', { name: 'Nueva mascota', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#appointment-pet').inputValue(), 'pet-added');
    await page.getByRole('button', { name: 'Cancelar', exact: true }).last().click();
    if (await page.getByRole('alertdialog').isVisible()) await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
    scenarios += 2;
    console.log('PASS: pet name error, locked owner, retained API failure and successful retry integrated into appointment.');

    // Hold only a page-level server read: the shared sidebar stays mounted.
    await page.goto(url('contacto'), { waitUntil: 'networkidle' });
    let releaseCash;
    control.cashGate(new Promise(resolve => { releaseCash = resolve; }));
    pendingReleases.push(releaseCash);
    await page.getByRole('link', { name: 'Punto de venta', exact: true }).first().click();
    const loading = page.getByRole('region', { name: 'Cargando el punto de venta', exact: true });
    await loading.waitFor();
    assert.equal(await loading.getAttribute('aria-busy'), 'true');
    assert.equal(await page.getByRole('link', { name: 'Agenda', exact: true }).first().isVisible(), true);
    assert.equal(await loading.getByText('$ 0', { exact: true }).count(), 0);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await noOverflow();
      await page.screenshot({ path: path.join(directory, `feedback-loading-${width}.png`), fullPage: true });
    }
    releaseCash(); control.cashGate(null);
    await loading.waitFor({ state: 'hidden' });
    await page.getByRole('heading', { name: 'Punto de venta', exact: true }).first().waitFor();
    scenarios++;
    console.log('PASS: real route Suspense fallback, mounted sidebar, no fake totals, recovery after delayed read at three widths.');

    // Expected API errors keep their local retry; malformed data triggers the
    // new render boundary, which retries without exposing exception details.
    control.endpoint('/clients');
    await page.goto(url('contacto'), { waitUntil: 'networkidle' });
    await page.getByRole('alert').filter({ hasText: 'El servidor de datos' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'No pudimos mostrar esta pantalla' }).count(), 0);
    control.endpoint(null);
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'El servidor de datos' }).waitFor({ state: 'hidden' });
    scenarios++;
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.evaluate(() => sessionStorage.setItem('fixture-retained-draft', 'pending-sale'));
    control.corrupt(true); await page.goto(url('contacto'), { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'No pudimos mostrar esta pantalla', exact: true }).waitFor();
    await focused('workspace-error-title');
    assert.equal(await page.locator('main').getByText(/TypeError|Cannot read|stack|\.tsx/).count(), 0);
    await page.screenshot({ path: path.join(directory, 'feedback-render-error.png'), fullPage: true });
    await noOverflow(); control.corrupt(false);
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await page.getByRole('heading', { name: 'No pudimos mostrar esta pantalla' }).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Nuevo cliente', exact: true }).waitFor();
    const injectedErrors = errors.splice(0);
    assert(injectedErrors.every(error => /null|reading/.test(error)), injectedErrors.join('\n'));
    assert.equal(await page.evaluate(() => sessionStorage.getItem('fixture-retained-draft')), 'pending-sale');
    control.corrupt(true); await page.goto(url('contacto'), { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'No pudimos mostrar esta pantalla' }).waitFor();
    control.corrupt(false); await page.getByRole('button', { name: 'Volver a Inicio' }).click();
    await page.waitForURL('**/dashboard?tenant=fixture-selected');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('fixture-retained-draft')), 'pending-sale');
    assert(errors.splice(0).every(error => /null|reading/.test(error)));
    scenarios += 2;
    assert(calls.filter(call => call.method !== 'GET').every(call => call.method === 'POST' && /\/(clients\/with-pets|pets)$/.test(call.path) && call.tenant === 'fixture-selected'));
    console.log('PASS: expected API error stays local; unexpected render error retries and returns Home with tenant and browser draft intact.');
    console.log(`PASS: ${scenarios} focused scenarios; fixture-only writes, zero real database changes or outgoing messages.`);
  } finally { pendingReleases.forEach(release => release()); control.cashGate(null); control.registrationGate(null); await context.close(); }
};
