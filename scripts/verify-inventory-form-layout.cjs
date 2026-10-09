// Browser checks against in-memory contracts only. Never uses the real database.
const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function verify({ login, origin, errors, directory, calls, control }) {
  control.inventoryFixtures();
  const {context, page} = await login('admin', 320);
  const releases = [];
  const url = route => origin + '/dashboard/' + route + (route.includes('?') ? '&' : '?') + 'tenant=fixture-selected';
  const dialog = () => page.getByRole('dialog').last();
  const footer = () => dialog().locator('[data-slot="dialog-footer"]');
  const writes = suffix => calls.filter(c => c.method === 'POST' && c.path.endsWith(suffix));
  const focused = id => page.waitForFunction(id => document.activeElement?.id === id, id);
  const check = text => console.log('PASS: ' + text);
  async function go(route = 'inventory') { await page.goto(url(route), {waitUntil:'networkidle'}); }
  async function close(discard = true) {
    await footer().getByRole('button', {name:/^Cerrar$|^Cancelar$/}).click();
    if (discard && await page.getByRole('alertdialog').isVisible()) await page.getByRole('button', {name:'Descartar cambios',exact:true}).click();
    await page.getByRole('dialog').waitFor({state:'hidden'});
  }
  async function layout(label, width) {
    const d = dialog(), body = d.locator('[data-form-body]');
    assert.equal(await body.count(), 1);
    const before = await footer().boundingBox();
    await body.evaluate(el => {el.scrollTop = el.scrollHeight;});
    const after = await footer().boundingBox();
    assert(Math.abs(before.y - after.y) < 1);
    assert(after.y >= 0 && after.y + after.height <= 609, JSON.stringify(after));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(await d.locator('button').evaluateAll(elements => elements.filter(el => {const r=el.getBoundingClientRect();return r.width&&r.height&&(r.left < -1 || r.right > innerWidth+1);}).map(el=>el.textContent)),[]);
    await page.screenshot({path:path.join(directory,`inventory-${label}-${width}.png`)});
  }
  async function entry() { await go(); await page.getByRole('button',{name:'Entrada',exact:true}).click(); await page.locator('#stock-quantity').waitFor(); }
  async function fillEntry(quantity = '2') {
    await page.locator('#stock-quantity').fill(quantity); await page.locator('#stock-cost').fill('12000,50');
    await page.locator('#stock-lotCode').fill('LOT-02'); await page.locator('#stock-expiresOn').fill('2030-01-01');
  }
  async function count() { await go(); await page.getByRole('button',{name:'Ver detalle',exact:true}).click(); await page.getByRole('button',{name:'Conteo físico',exact:true}).click(); }
  async function correction() { await go(); await page.getByRole('button',{name:'Ver detalle',exact:true}).click(); await page.getByRole('tab',{name:'Movimientos',exact:true}).click(); await page.getByRole('button',{name:'Corregir unidades no utilizadas',exact:true}).click(); }
  async function consumption() { await go(); await page.getByRole('button',{name:'Insumos utilizados',exact:true}).click(); }
  async function selectInsumo() { await page.locator('#consumption-search').fill('Champú'); await page.getByRole('listbox').getByRole('option').first().waitFor(); await page.locator('#consumption-search').press('ArrowDown'); await page.locator('#consumption-search').press('Enter'); await page.locator('#consumption-quantity-product-fixture').waitFor(); }
  async function returned() { await go('pos?tab=historial'); await page.getByRole('button',{name:'Recibir devolución',exact:true}).click(); }
  async function verifyZoom() {
    // Reflow equivalent to 200% zoom on a 640x1216 display: 320x608 CSS px,
    // with each CSS pixel rendered as two physical pixels.
    const zoom = await login('admin',320,{height:608,deviceScaleFactor:2});
    try {
      await zoom.page.goto(url('inventory'),{waitUntil:'networkidle'});
      await zoom.page.getByRole('button',{name:'Entrada',exact:true}).click();
      assert.deepEqual(await zoom.page.evaluate(()=>[innerWidth,innerHeight,devicePixelRatio]),[320,608,2]);
      const zDialog = zoom.page.getByRole('dialog');
      const zFooter = await zDialog.locator('[data-slot="dialog-footer"]').boundingBox();
      assert(zFooter.y>=0&&zFooter.y+zFooter.height<=609,JSON.stringify(zFooter));
      assert(await zoom.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await zoom.page.screenshot({path:path.join(directory,'inventory-entry-zoom200.png')});
      check('Entry passes emulated 200% reflow with doubled pixels; fixed actions remain visible and no horizontal page overflow.');
    } finally { await zoom.context.close(); }
  }
  try {
    if (process.argv.includes('--inventory-zoom-only')) { await verifyZoom(); return; }
    for (const width of [320,768,1440]) {
      await page.setViewportSize({width,height:608}); await go();
      const cards = page.locator('[data-inventory-cards]');
      assert.equal(await cards.isVisible(), width < 1280);
      assert.equal(await page.getByRole('table').count(),width < 1280 ? 0 : 1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1));
      await page.screenshot({path:path.join(directory,`inventory-list-${width}.png`),fullPage:true});
      check(`${width}px: inventory cards/table, stock, price and actions fit the viewport.`);

      await entry(); const n = writes('/entries').length;
      await page.locator('#stock-quantity').focus(); await page.keyboard.press('Tab'); await focused('stock-cost');
      await page.keyboard.press('Shift+Tab'); await focused('stock-quantity');
      await footer().getByRole('button',{name:'Guardar entrada',exact:true}).click(); await focused('stock-quantity');
      await page.locator('#stock-quantity').fill('1.5'); await footer().getByRole('button',{name:'Guardar entrada',exact:true}).click(); await focused('stock-quantity');
      await fillEntry(); await page.locator('#stock-cost').fill('12.000'); await footer().getByRole('button',{name:'Guardar entrada',exact:true}).click(); await focused('stock-cost');
      await page.locator('#stock-cost').fill('12000,50'); await page.locator('#stock-lotCode').fill(''); await footer().getByRole('button',{name:'Guardar entrada',exact:true}).click(); await focused('stock-lotCode');
      assert.equal(writes('/entries').length,n); await fillEntry();
      await layout('entry',width);
      await footer().getByRole('button',{name:'Cancelar',exact:true}).click(); await page.getByRole('alertdialog').waitFor();
      await page.getByRole('button',{name:'Seguir editando',exact:true}).click(); assert.equal(await page.locator('#stock-lotCode').inputValue(),'LOT-02');
      await footer().getByRole('button',{name:'Guardar entrada',exact:true}).click(); await page.getByText('Movimiento registrado.',{exact:false}).waitFor();
      assert.equal(writes('/entries').length,n+1); assert.deepEqual(writes('/entries').at(-1).body,{quantity:2,unitCost:'12000.50',lotCode:'LOT-02',expiresOn:'2030-01-01',reason:null}); await close();
      check(`${width}px: entry validation prevents invalid writes, retains drafts, and saves tracked lot/cost with fixed footer.`);

      await count(); const c = writes('/adjustments').length;
      await page.locator('#stock-lot').selectOption(''); await footer().getByRole('button',{name:'Guardar conteo',exact:true}).click(); await focused('stock-lot');
      await page.locator('#stock-lot').selectOption('lot-fixture'); await page.locator('#stock-quantity').fill('0');
      await footer().getByRole('button',{name:'Guardar conteo',exact:true}).click(); await focused('stock-reason'); assert.equal(writes('/adjustments').length,c);
      await page.locator('#stock-reason').fill('Sin unidades físicas'); await layout('count',width);
      control.inventory(409); await footer().getByRole('button',{name:'Guardar conteo',exact:true}).click(); await dialog().getByText(/existencias cambiaron/).waitFor();
      assert.equal(await page.locator('#stock-quantity').inputValue(),'0'); assert.equal(await page.locator('#stock-reason').inputValue(),'Sin unidades físicas');
      control.inventory(0); await footer().getByRole('button',{name:'Guardar conteo',exact:true}).click(); await page.getByText('Movimiento registrado.',{exact:false}).waitFor();
      assert.deepEqual(writes('/adjustments').at(-1).body,{lotId:'lot-fixture',countedQuantity:0,expectedStockRevision:1,reason:'Sin unidades físicas'}); await close();
      check(`${width}px: count accepts zero, requires lot/reason, preserves conflict draft and stock revision.`);

      await correction(); const corr = writes('/corrections').length;
      await page.locator('#stock-quantity').fill('3'); await footer().getByRole('button',{name:'Guardar corrección',exact:true}).click(); await focused('stock-quantity');
      await page.locator('#stock-quantity').fill('1'); await footer().getByRole('button',{name:'Guardar corrección',exact:true}).click(); await focused('stock-reason');
      assert.equal(writes('/corrections').length,corr); await page.locator('#stock-reason').fill('Unidad no utilizada'); await layout('correction',width);
      await footer().getByRole('button',{name:'Guardar corrección',exact:true}).click(); await page.getByText('Movimiento registrado.',{exact:false}).waitFor();
      assert.deepEqual(writes('/corrections').at(-1).body,{sourceMovementId:'movement-fixture',quantity:1,reason:'Unidad no utilizada'}); await close();
      check(`${width}px: correction cannot exceed original consumption; additive payload and fixed footer.`);

      await consumption(); const cons = writes('/consumptions').length;
      await footer().getByRole('button',{name:'Guardar consumo',exact:true}).click(); await focused('consumption-products');
      await selectInsumo(); await page.locator('#consumption-quantity-product-fixture').fill('0'); await footer().getByRole('button',{name:'Guardar consumo',exact:true}).click(); await focused('consumption-quantity-product-fixture');
      await page.locator('#consumption-quantity-product-fixture').fill('1'); await footer().getByRole('button',{name:'Guardar consumo',exact:true}).click(); await focused('consumption-reason');
      assert.equal(writes('/consumptions').length,cons); await page.locator('#consumption-reason').fill('Material utilizado'); await layout('consumption',width);
      await footer().getByRole('button',{name:'Guardar consumo',exact:true}).click(); await page.locator('#consumption-quantity-product-fixture').waitFor({state:'hidden'});
      assert.equal(await page.locator('#consumption-reason').inputValue(),''); assert.equal(writes('/consumptions').at(-1).body.appointmentId,null); await close();
      check(`${width}px: keyboard product selection, inline selection/quantity/reason errors, consumption confirmation clears own draft.`);

      await returned(); const ret = writes('/inventory-returns').length;
      await footer().getByRole('button',{name:'Guardar recepción',exact:true}).click(); await focused('return-items');
      assert.equal(await page.locator('#return-line-line-returned').isDisabled(),true);
      await page.locator('#return-line-line-fixture').check(); await footer().getByRole('button',{name:'Guardar recepción',exact:true}).click(); await focused('return-reason');
      assert.equal(writes('/inventory-returns').length,ret); await page.locator('#return-disposition-line-fixture').selectOption('discard'); await page.locator('#return-reason').fill('Mercancía dañada');
      await layout('return',width); await footer().getByRole('button',{name:'Guardar recepción',exact:true}).click(); await page.getByText(/Devolución registrada\. Puedes/).waitFor();
      assert.deepEqual(writes('/inventory-returns').at(-1).body,{reason:'Mercancía dañada',items:[{transactionItemId:'line-fixture',disposition:'discard'}]}); await page.getByRole('dialog').waitFor({state:'hidden'});
      check(`${width}px: returns require complete selected lines/reason, lock already returned lines, preserve disposition without financial writes.`);
    }
    await page.setViewportSize({width:768,height:608});
    await entry(); await fillEntry(); let release; control.inventoryGate(new Promise(r=>{release=r;releases.push(r);}));
    const busyBefore = writes('/entries').length; await footer().getByRole('button',{name:'Guardar entrada',exact:true}).click();
    await footer().getByRole('button',{name:'Guardando…',exact:true}).waitFor();
    assert.equal(await footer().getByRole('button',{name:/^Cancelar$|^Cerrar$/}).isDisabled(),true);
    await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(),1);
    assert.equal(writes('/entries').length,busyBefore+1); release(); control.inventoryGate(null);
    await page.getByText('Movimiento registrado.',{exact:false}).waitFor(); await close();
    await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Entrada');
    check('Slow entry blocks closing and duplicate submission until confirmation.');

    await entry(); await fillEntry(); control.inventory(503);
    const uncertainBefore = writes('/entries').length; await footer().getByRole('button',{name:'Guardar entrada',exact:true}).click();
    await dialog().getByText(/Cerrar esta ventana no cancela/).waitFor();
    await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-inventory-feedback'));
    await close(); assert.equal(await page.getByRole('alertdialog').count(),0);
    assert(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('mateos-inventory-pending-v1:')&&localStorage.getItem(k).includes('LOT-02'))));
    control.inventory(0); await page.getByRole('button',{name:'Consultar resultado',exact:true}).click(); await page.getByText(/Resultado por comprobar/).waitFor({state:'hidden'});
    assert.equal(writes('/entries').length,uncertainBefore+1);
    check('Uncertain entry remains durable after closing; workspace recovery confirms it without duplicate write.');

    await returned(); await page.locator('#return-line-line-fixture').check(); await page.locator('#return-reason').fill('Recepción apta');
    control.inventory(503); control.pendingStored(false); const retryBefore = writes('/inventory-returns').length;
    await footer().getByRole('button',{name:'Guardar recepción',exact:true}).click(); await dialog().getByText(/Resultado por comprobar/).waitFor();
    control.inventory(0); control.pendingStored(true); await dialog().getByRole('button',{name:'Reintentar operación',exact:true}).click(); await page.getByText(/Devolución registrada\. Puedes/).waitFor();
    const attempts = writes('/inventory-returns').slice(retryBefore); assert.equal(attempts.length,2); assert.equal(attempts[0].operationKey,attempts[1].operationKey); assert.deepEqual(attempts[0].body,attempts[1].body); await page.getByRole('dialog').waitFor({state:'hidden'});
    check('Uncertain return retries the same durable key/content; own confirmation refreshes history and closes editor.');

    await consumption(); await selectInsumo(); await page.locator('#consumption-reason').fill('Borrador');
    await page.locator('#consumption-search').fill('Champú'); await page.getByRole('listbox').getByRole('option').first().waitFor(); await page.locator('#consumption-search').press('Escape');
    assert.equal(await page.getByRole('alertdialog').count(),0); assert.equal(await page.getByRole('dialog').count(),1);
    await page.locator('#consumption-reason').focus(); await page.keyboard.press('Escape'); await page.getByRole('alertdialog').waitFor();
    await page.getByRole('button',{name:'Seguir editando',exact:true}).click(); assert.equal(await page.locator('#consumption-reason').inputValue(),'Borrador'); await close();
    check('Escape dismisses product suggestions first and protects a consumption draft on dialog dismissal.');

    await consumption(); await selectInsumo(); await page.locator('#consumption-reason').fill('Recuperar consumo'); control.inventory(503);
    await footer().getByRole('button',{name:'Guardar consumo',exact:true}).click(); await dialog().getByText(/Resultado por comprobar/).waitFor();
    control.inventory(0); await dialog().getByRole('button',{name:'Consultar resultado',exact:true}).click(); await page.locator('#consumption-quantity-product-fixture').waitFor({state:'hidden'}); assert.equal(await page.locator('#consumption-reason').inputValue(),''); await close();
    check('Consumption recovery clears only its confirmed items and reason.');

    await go('peluqueria'); await page.getByRole('button',{name:'Notas de la atención',exact:true}).click(); await page.getByRole('button',{name:'Insumos utilizados',exact:true}).click(); await selectInsumo();
    await footer().getByRole('button',{name:'Guardar consumo',exact:true}).click(); await page.locator('#consumption-quantity-product-fixture').waitFor({state:'hidden'});
    assert.equal(writes('/consumptions').at(-1).body.appointmentId,'case-grooming'); assert.equal(writes('/consumptions').at(-1).body.reason,null);
    await footer().getByRole('button',{name:'Cerrar',exact:true}).click(); await page.locator('#consumption-search').waitFor({state:'hidden'}); await close();
    check('Supplies used during an appointment preserve appointment link; reason remains optional.');

    await go('contacto'); await page.getByRole('button',{name:'Nuevo cliente',exact:true}).click(); await page.getByRole('button',{name:'Agregar otra mascota'}).click();
    const remove=await page.getByRole('button',{name:'Quitar mascota 2',exact:true}).boundingBox(); const x=await dialog().getByRole('button',{name:'Cerrar',exact:true}).boundingBox();
    assert(remove.width>=44&&remove.height>=44); assert(x.width>=44&&x.height>=44);
    await page.getByRole('button',{name:'Quitar mascota 2',exact:true}).focus(); await page.keyboard.press('Enter'); assert.equal(await page.getByRole('button',{name:'Quitar mascota 2',exact:true}).count(),0); await close();
    check('Pet remove and modal close targets are 44px; pet removal works with keyboard.');

    await verifyZoom();
    control.inventoryName('Producto con nombre extenso para revisar el ajuste de línea y una referencia '+ 'X'.repeat(80));
    await page.setViewportSize({width:320,height:608}); await go();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(directory,'inventory-long-name-320.png'),fullPage:true});
    control.inventoryName('Champú de prueba');
    check('Long product names and unbroken references wrap within mobile cards.');
    for (const role of ['vet','groomer','receptionist']) {
      const user=await login(role,768); await user.page.goto(url('inventory'),{waitUntil:'networkidle'});
      assert.equal(await user.page.getByRole('button',{name:'Entrada',exact:true}).count(),0);
      if (role!=='receptionist') assert.equal(await user.page.getByText(/Precio de venta/).count(),0);
      assert.equal(await user.page.getByText(/Costo de referencia/).count(),0); await user.context.close();
      check(`${role}: inventory cards preserve management and financial visibility permissions.`);
    }
    assert.equal(errors.length,0,errors.join('\n'));
    assert(calls.filter(c=>c.method!=='GET').every(c=>/\/(entries|adjustments|corrections|consumptions|inventory-returns)$/.test(c.path)), 'Unexpected financial or historical mutation');
    check('Zero browser errors, no real DB writes or external messages; only additive fixture inventory commands.');
  } finally { releases.forEach(r=>r()); control.inventoryGate(null); control.inventory(0); control.pendingStored(true); await context.close(); }
};
