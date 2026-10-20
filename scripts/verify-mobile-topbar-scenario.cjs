const assert = require('node:assert/strict');
const path = require('node:path');
module.exports = async function ({ base, page, output, check }) {
  const destinations = ['/dashboard', '/dashboard/calendar', '/dashboard/contacto?view=clientes', '/dashboard/consultas', '/dashboard/peluqueria', '/dashboard/pos?tab=caja', '/dashboard/inventory', '/dashboard/settings'];
  for (const destination of destinations) {
    await page.goto(base + destination);
    const quick = page.getByRole('group', { name: 'Accesos rápidos', exact: true });
    await quick.waitFor();
    for (const width of [320, 360, 390, 430, 640, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), destination + ' overflows at ' + width);
      const actions = await quick.locator('a:visible, button:visible, input:visible').evaluateAll(elements => elements.map(element => {
        const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      }).sort((a, b) => a.x - b.x));
      assert.equal(actions.length, 3);
      assert(actions.every(box => box.width >= 44 && box.height >= 44 && box.right <= width), destination + ' must keep 44px actions inside header');
      for (let index = 1; index < actions.length; index++) assert(actions[index].x - actions[index - 1].right >= 11, 'Quick actions need visible spacing');
      const menu = page.getByRole('button', { name: 'Abrir menú', exact: true });
      if (width < 1024) {
        const box = await menu.boundingBox(); assert(box && box.width >= 44 && box.height >= 44);
        for (const action of actions) assert(action.y - (box.y + box.height) >= 12 || action.x - (box.x + box.width) >= 12, destination + ' menu crowds a quick action at ' + width);
      } else assert.equal(await menu.isVisible(), false);
    }
    await page.setViewportSize({ width: 390, height: 800 });
    await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar menú', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Cerrar menú', exact: true }).count(), 0);
    if (destination === '/dashboard/calendar' || destination === '/dashboard') {
      await page.evaluate(() => window.scrollTo(0, 450));
      const menu = await page.getByRole('button', { name: 'Abrir menú', exact: true }).boundingBox();
      const actions = await quick.boundingBox(); assert(menu && actions && actions.y - menu.y - menu.height >= 12);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, destination === '/dashboard' ? '45-mobile-topbar-home.png' : '44-mobile-topbar-agenda.png'), animations: 'disabled' });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  check('shared topbar keeps menu and quick actions separated on eight sections at 320–1440 widths, with 44px touch targets, sticky scroll and working mobile drawer');
};
