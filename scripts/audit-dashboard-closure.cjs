// Acceptance checks replacing the original diagnostic reproductions.
const assert = require('node:assert/strict');
const path = require('node:path');
const secondary = require.resolve('./verify-secondary-form-layout.cjs');
require.cache[secondary] = { id: secondary, filename: secondary, loaded: true, exports: verify };
process.argv.push('--secondary-forms-only');
require('./verify-general-dashboard.cjs');

async function verify({ login, origin, directory, errors }) {
  const { context, page } = await login('admin', 768);
  page.setDefaultTimeout(30000);
  let release, count = 0;
  const check = message => { count++; console.log('PASS: ' + message); };
  const d = () => page.getByRole('dialog').last();
  const settlePath = '**/api/proxy/dashboard/transactions/secondary-charge/settle*';
  const detailPath = '**/api/proxy/dashboard/transactions/secondary-charge?*';
  const payment = async () => {
    await page.goto(origin + '/dashboard/pos?tab=caja&tenant=fixture-selected', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Revisar pago', exact: true }).click();
    await d().getByRole('button', { name: 'Recibí el valor exacto', exact: true }).click();
  };
  const close = async () => {
    await d().locator('[data-slot="dialog-footer"]').getByRole('button', { name: 'Cerrar', exact: true }).click();
    if (await page.getByRole('alertdialog').isVisible()) await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar cambios', exact: true }).click();
    await d().waitFor({ state: 'hidden' });
  };
  try {
    await page.route(settlePath, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await payment();
    await d().getByRole('button', { name: 'Confirmar método de pago', exact: true }).click();
    await d().getByRole('button', { name: 'Comprobar resultado', exact: true }).waitFor();
    assert(await d().isVisible()); assert(await page.locator('#payment-method').isDisabled());
    assert.equal(await page.getByText('Método de pago confirmado. El importe del servicio se conserva.', { exact: true }).count(), 0);
    await d().getByRole('button', { name: 'Comprobar resultado', exact: true }).click();
    await d().getByRole('button', { name: 'Confirmar método de pago', exact: true }).waitFor();
    check('HTTP 200 with an incomplete payment never announces success; checking an unconfirmed charge restores the retained draft.');
    await close(); await page.unroute(settlePath);

    let attempts = 0, committed = false, saved;
    await page.route(detailPath, async route => {
      if (committed) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(saved) });
      else { const response = await route.fetch(); saved = await response.json(); await route.fulfill({ response }); }
    });
    await page.route(settlePath, async route => { attempts++; saved = { ...saved, ...route.request().postDataJSON(), recordedBy: { id: 'admin:fixture', name: 'Administrador', role: 'admin' } }; committed = true; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Resultado por comprobar' }) }); });
    await payment();
    await d().getByRole('button', { name: 'Confirmar método de pago', exact: true }).click();
    await d().getByRole('button', { name: 'Comprobar resultado', exact: true }).waitFor();
    assert.equal(await d().getByRole('button', { name: 'Confirmar método de pago', exact: true }).count(), 0);
    await close();
    await page.getByRole('button', { name: 'Revisar pago', exact: true }).click();
    await d().getByRole('button', { name: 'Comprobar resultado', exact: true }).click();
    await page.getByText('Método de pago confirmado. El importe del servicio se conserva.', { exact: true }).waitFor();
    assert.equal(attempts, 1);
    check('A persisted payment with a lost response survives close/reopen and is recovered by GET without a second POST.');
    await page.unroute(detailPath); await page.unroute(settlePath);

    const gate = new Promise(resolve => { release = resolve; });
    await page.route(settlePath, async route => { await gate; await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Fin de prueba' }) }).catch(() => {}); });
    await payment();
    await d().getByRole('button', { name: 'Confirmar método de pago', exact: true }).click();
    await d().getByRole('button', { name: 'Guardando…', exact: true }).waitFor();
    assert(await d().locator('[data-slot="dialog-footer"]').getByRole('button', { name: 'Cerrar', exact: true }).isDisabled());
    await d().getByRole('button', { name: 'Comprobar resultado', exact: true }).waitFor();
    assert(await d().locator('[data-slot="dialog-footer"]').getByRole('button', { name: 'Cerrar', exact: true }).isEnabled());
    assert.equal(await page.locator('#payment-received').inputValue(), '66000');
    release(); release = null; await page.unroute(settlePath);
    check('A request exceeding the client deadline unlocks the dialog, retains its values and requires a result check.');
    await close();

    await page.route('**/api/proxy/dashboard/appointments/case-veterinary/medical-record*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'record-review', version: 1, reason: 'Consulta registrada de prueba', staffId: 'vet', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), weight: null, nextControlAt: null }) }));
    let failActions = true, actionReads = 0;
    await page.route('**/api/proxy/dashboard/pets/pet-existing/next-actions*', route => { actionReads++; return route.fulfill({ status: failActions ? 503 : 200, contentType: 'application/json', body: failActions ? '{"error":"No disponible"}' : '[]' }); });
    await page.goto(origin + '/dashboard/consultas?tenant=fixture-selected', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Registrar atención', exact: true }).click();
    await d().getByRole('heading', { name: 'Consulta registrada', exact: true }).waitFor();
    await d().getByRole('button', { name: 'Reintentar seguimientos', exact: true }).waitFor();
    await d().getByRole('button', { name: 'Editar registro', exact: true }).click();
    await d().getByLabel('Diagnóstico', { exact: true }).fill('Borrador que debe conservarse');
    failActions = false;
    await d().getByRole('button', { name: 'Reintentar seguimientos', exact: true }).click();
    await d().getByRole('button', { name: 'Reintentar seguimientos', exact: true }).waitFor({ state: 'hidden' });
    assert.equal(await d().getByLabel('Diagnóstico', { exact: true }).inputValue(), 'Borrador que debe conservarse');
    assert.equal(actionReads, 2);
    await page.screenshot({ path: path.join(directory, 'closure-followup-recovered.png') });
    check('Followup failure is explicit; retrying only that section preserves the clinical draft.');

    await page.goto(origin + '/dashboard/calendar?tenant=fixture-selected', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Toby, propietario Ana Prueba, servicio Consulta de prueba', exact: true }).click();
    await d().getByRole('button', { name: 'Cambiar precio', exact: true }).click();
    let submittedPrice;
    const priceGate = new Promise(resolve => { release = resolve; });
    await page.route('**/api/proxy/dashboard/appointments/case-veterinary*', async route => {
      const body = route.request().postDataJSON(); submittedPrice = body.price ?? body.finalPrice;
      await priceGate;
      await route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Validación de prueba"}' }).catch(() => {});
    });
    await page.locator('#appointment-price').fill('50000');
    await d().getByRole('button', { name: 'Guardar precio', exact: true }).click();
    await d().locator('form').getByRole('button', { name: 'Guardando…', exact: true }).waitFor();
    assert(await page.locator('#appointment-price').isDisabled());
    release(); release = null;
    await d().getByRole('alert').waitFor();
    assert.equal(submittedPrice, 50000); assert.equal(await page.locator('#appointment-price').inputValue(), '50000');
    assert(await page.locator('#appointment-price').isEnabled());
    check('Appointment price freezes during save and remains in the editor after a rejected response.');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(`Closure acceptance checks: ${count} passed, 0 failed. Fixture-only writes; no business data or outgoing messages.`);
  } finally { release?.(); await context.close(); }
}
