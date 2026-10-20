const assert = require('node:assert/strict');
const path = require('node:path');

// Geometry and draft checks only. Appointment writes remain in the existing scenario.
module.exports = async function verify({ page, dialog, output, check }) {
  const body = dialog.locator('[data-appointment-body]');
  const header = dialog.locator('[data-slot="dialog-header"]');
  const footer = dialog.locator('[data-slot="dialog-footer"]');
  for (const [width, height] of [[320,568],[390,720],[768,800],[1440,1000]]) {
    await page.setViewportSize({ width, height });
    await dialog.evaluate(async el => { await Promise.all(el.getAnimations().map(animation => animation.finished)); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    await body.evaluate(el => { el.scrollTop = 0; });
    const box = await dialog.boundingBox();
    await page.screenshot({ path: path.join(output, `49-appointment-detail-${width}.png`), animations:'disabled' });
    assert(box.x >= 12 && box.x + box.width <= width - 12, JSON.stringify({width,height,box}));
    assert(box.y >= 12 && box.y + box.height <= height - 12, JSON.stringify({width,height,box}));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(await dialog.locator('[data-slot="badge"]').count(), 1);
    const a = await header.boundingBox(), f = await footer.boundingBox();
    await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
    const b = await header.boundingBox(), g = await footer.boundingBox();
    assert(Math.abs(a.y - b.y) < 1 && Math.abs(f.y - g.y) < 1, 'Header and actions must not move with appointment details');
    assert(g.y >= box.y && g.y + g.height <= box.y + box.height + 1);
    const invalid = await footer.locator('button, a').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { text: el.textContent, width:r.width,height:r.height,left:r.left,right:r.right }; }).filter(r => r.width && r.height && (r.height < 43 || r.left < 0 || r.right > innerWidth)));
    assert.deepEqual(invalid, []);
    await body.evaluate(el => { el.scrollTop = 0; });
    const summary = await dialog.getByRole('region', { name: 'Resumen de la atención', exact: true }).boundingBox();
    const transport = await dialog.getByRole('region', { name: 'Domicilio de peluquería', exact: true }).boundingBox();
    if (width >= 768) assert(transport.x > summary.x && Math.abs(transport.y - summary.y) < 1);
    else assert(transport.y > summary.y);
    await page.screenshot({ path: path.join(output, `49-appointment-detail-${width}.png`), animations:'disabled' });
  }
  await page.setViewportSize({ width:320,height:568 });
  await dialog.getByRole('button', { name:'Cambiar precio',exact:true }).click();
  await page.locator('#appointment-price').waitFor();
  await page.locator('#appointment-price').fill('12345');
  await page.keyboard.press('Escape');
  await page.getByRole('alertdialog').getByRole('button', { name:'Seguir editando',exact:true }).click();
  assert.equal(await page.locator('#appointment-price').inputValue(), '12345');
  await dialog.getByRole('button', { name:'Cancelar',exact:true }).click();
  await body.evaluate(el => { el.scrollTop = 0; });
  await page.setViewportSize({ width:1440,height:1000 });
  check('appointment detail fits 320–1440 widths and short mobile screens, shows status once, aligns desktop columns, keeps header/actions fixed and preserves unsaved price drafts');
};
