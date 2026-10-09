// Secondary financial forms: real browser, isolated in-memory API fixtures.
const assert = require('node:assert/strict');
const path = require('node:path');

module.exports = async function verify({login,origin,errors,directory,calls,control}) {
  const {context,page} = await login('admin',320,{height:608});
  let release;
  const dialog = () => page.getByRole('dialog');
  const count = suffix => calls.filter(c=>c.method==='POST'&&c.path.endsWith(suffix)).length;
  const check = label => console.log('PASS: '+label);
  async function open(kind) {
    await page.goto(origin+'/dashboard/pos?tenant=fixture-selected&tab='+(kind==='payment'?'caja':'historial'),{waitUntil:'networkidle'});
    await page.getByRole('button',{name:kind==='payment'?'Revisar pago':'Anular',exact:true}).click();
    await dialog().locator('[data-form-body]').waitFor();
  }
  async function layout(kind,width) {
    const d = dialog(), footer = d.locator('[data-slot="dialog-footer"]');
    const before = await footer.boundingBox();
    await d.locator('[data-form-body]').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    const after = await footer.boundingBox();
    assert(Math.abs(before.y-after.y)<1);
    assert(after.y>=0&&after.y+after.height<=609,JSON.stringify(after));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.deepEqual(await d.locator('button').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.height<43||r.left<0||r.right>innerWidth+1);}).map(el=>el.textContent)),[]);
    await page.screenshot({path:path.join(directory,`secondary-${kind}-${width}.png`)});
  }
  async function discard() {
    await page.keyboard.press('Escape');
    const alert=page.getByRole('alertdialog');
    if(await alert.isVisible())await alert.getByRole('button',{name:'Descartar cambios',exact:true}).click();
    await dialog().waitFor({state:'hidden'});
  }
  async function contrast() {
    const samples=await dialog().evaluate(root=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
      const lum=rgb=>Array.from(rgb).slice(0,3).map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
      return Array.from(root.querySelectorAll('label,[id$="-hint"],[id$="-error"],[data-slot="dialog-description"],button')).filter(el=>!el.disabled&&el.getBoundingClientRect().height>0).map(el=>{
        const ancestors=[];for(let p=el;p;p=p.parentElement)ancestors.unshift(p);
        ctx.fillStyle='white';ctx.fillRect(0,0,1,1);for(const p of ancestors){ctx.fillStyle=getComputedStyle(p).backgroundColor;ctx.fillRect(0,0,1,1);}
        const bg=ctx.getImageData(0,0,1,1).data;ctx.fillStyle=getComputedStyle(el).color;ctx.fillRect(0,0,1,1);const fg=ctx.getImageData(0,0,1,1).data;
        const a=lum(bg),b=lum(fg),style=getComputedStyle(el),size=parseFloat(style.fontSize);
        return {label:el.textContent.trim().slice(0,75),color:style.color,background:style.backgroundColor,foreground:[...fg],bg:[...bg],ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),minimum:size>=24||size>=18.66&&parseInt(style.fontWeight)>=700?3:4.5};
      });
    });
    assert.deepEqual(samples.filter(x=>x.ratio+.01<x.minimum),[],JSON.stringify(samples));
    check('Computed contrast of financial form labels, hints, errors, description and enabled buttons meets AA text thresholds.');
  }
  try {
    for(const width of [320,768,1440]) {
      await page.setViewportSize({width,height:608});
      for(const kind of ['payment','void']) {
        control.resetSecondary(); await open(kind); const before=count(kind==='payment'?'/settle':'/void');
        await dialog().getByRole('button',{name:kind==='payment'?'Confirmar método de pago':'Confirmar anulación',exact:true}).click();
        const id=kind==='payment'?'payment-received':'sale-void-reason';
        await page.waitForFunction(id=>document.activeElement?.id===id,id);
        assert.equal(await page.locator('#'+id).getAttribute('aria-invalid'),'true');
        assert((await page.locator('#'+id).getAttribute('aria-describedby')).includes(id+'-error'));
        assert.equal(count(kind==='payment'?'/settle':'/void'),before);
        if(width===320)await contrast();
        await layout(kind,width); await discard();
        await page.waitForFunction(kind=>kind==='payment' ? document.activeElement?.textContent==='Revisar pago' : document.activeElement?.textContent?.trim()==='Anular',kind);
        check(`${kind} at ${width}px: inline errors, labelled field focus, zero invalid writes, fixed visible actions and 44px buttons.`);
      }
    }
    await page.setViewportSize({width:320,height:608});
    for(const kind of ['payment','void']) {
      control.resetSecondary(); await open(kind);
      const id=kind==='payment'?'payment-received':'sale-void-reason';
      await page.locator('#'+id).fill(kind==='payment'?'66000':'Motivo de prueba');
      await page.keyboard.press('Escape');
      await page.getByRole('alertdialog').getByRole('button',{name:'Seguir editando',exact:true}).click();
      assert.equal(await page.locator('#'+id).inputValue(),kind==='payment'?'66000':'Motivo de prueba');
      await page.waitForFunction(()=>document.querySelector('[role="dialog"]')?.contains(document.activeElement));
      control.secondaryFailure(400);
      await dialog().getByRole('button',{name:kind==='payment'?'Confirmar método de pago':'Confirmar anulación',exact:true}).click();
      await dialog().getByRole('alert').waitFor();
      assert.equal(await page.locator('#'+id).inputValue(),kind==='payment'?'66000':'Motivo de prueba');
      control.secondaryFailure(0);
      const before=count(kind==='payment'?'/settle':'/void');
      control.secondaryGate(new Promise(resolve=>{release=resolve;}));
      const button=dialog().getByRole('button',{name:kind==='payment'?'Confirmar método de pago':'Confirmar anulación',exact:true});
      await button.click(); await page.waitForFunction(()=>document.querySelector('button[type="submit"]:disabled')!==null);
      await page.keyboard.press('Escape'); assert(await dialog().isVisible());
      assert.equal(count(kind==='payment'?'/settle':'/void'),before+1);
      release(); control.secondaryGate(null);
      if(kind==='payment')await dialog().waitFor({state:'hidden'});
      else {await dialog().getByRole('heading',{name:'Venta anulada',exact:true}).waitFor();await dialog().locator('[data-slot="dialog-footer"]').getByRole('button',{name:'Cerrar',exact:true}).click();}
      if(kind==='void') await page.waitForFunction(()=>document.activeElement?.id==='history-search');
      check(`${kind}: Escape keeps draft and focus, rejected save preserves values, busy dismissal blocked and one valid write.`);
    }
    control.resetSecondary(); await open('void');
    await page.locator('#sale-void-reason').fill('Anulación con respuesta incierta'); control.secondaryFailure(503);
    const n=count('/void'); await dialog().getByRole('button',{name:'Confirmar anulación',exact:true}).click();
    await dialog().getByRole('button',{name:'Comprobar anulación',exact:true}).waitFor();
    assert.equal(count('/void'),n+1); assert.equal(await dialog().getByRole('button',{name:'Confirmar anulación',exact:true}).count(),0);
    await dialog().getByRole('button',{name:'Cerrar y comprobar después',exact:true}).click();
    assert.equal(await page.getByRole('alertdialog').count(),0);
    await page.getByRole('button',{name:'Anular',exact:true}).click();
    await dialog().getByRole('button',{name:'Comprobar anulación',exact:true}).click();
    await dialog().getByRole('button',{name:'Confirmar anulación',exact:true}).waitFor();
    assert.equal(count('/void'),n+1);
    control.secondaryFailure(0); await discard();
    check('Uncertain void remains recoverable after close/reopen; checking never repeats the financial write.');

    for(const active of [true,false]) {
      control.emptyProduct(active); await page.goto(origin+'/dashboard/inventory?tenant=fixture-selected',{waitUntil:'networkidle'});
      if(!active) await page.getByLabel('Incluir desactivados',{exact:true}).check();
      await page.getByRole('button',{name:'Ver detalle',exact:true}).click();
      assert(await dialog().getByRole('button',{name:'Conteo físico',exact:true}).isDisabled());
      await dialog().locator('#inventory-count-help').waitFor();
      assert((await dialog().locator('#inventory-count-help').textContent()).includes(active?'Registra una entrada':'Activa el producto'));
      await dialog().locator('[data-slot="dialog-footer"]').getByRole('button',{name:'Cerrar',exact:true}).click();
      check(`Inventory ${active?'active':'inactive'}: disabled count has visible guidance without granting additional actions.`);
    }
    for(const role of ['receptionist','vet','groomer']) {
      const x=await login(role,768);
      try {
        await x.page.goto(origin+'/dashboard/pos?tab=historial',{waitUntil:'networkidle'});
        assert.equal(await x.page.getByRole('button',{name:'Anular',exact:true}).count(),0);
        check(`${role}: financial cancellation remains unavailable.`);
      } finally {await x.context.close();}
    }
    const reflow=await login('admin',320,{height:608,deviceScaleFactor:2});
    try {
      await reflow.page.goto(origin+'/dashboard/pos?tab=caja&tenant=fixture-selected',{waitUntil:'networkidle'});
      await reflow.page.getByRole('button',{name:'Revisar pago',exact:true}).click();
      const d=reflow.page.getByRole('dialog'),footer=await d.locator('[data-slot="dialog-footer"]').boundingBox();
      assert(footer.y>=0&&footer.y+footer.height<=609);
      assert(await reflow.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await reflow.page.screenshot({path:path.join(directory,'secondary-payment-reflow200.png')});
      check('Payment fits 200% equivalent reflow; this does not substitute manual Chrome zoom or a screen reader.');
    }finally{await reflow.context.close();}
    assert.equal(errors.length,0,errors.join('\n'));
    check('No browser runtime errors; only isolated fixture writes, no external messages.');
  } finally {release?.();control.secondaryGate(null);control.secondaryFailure(0);await context.close();}
};
