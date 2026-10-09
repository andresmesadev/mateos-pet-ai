// Read-only local UI verification. Credentials/cookies stay in memory.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
require('../node_modules/dotenv').config({ path: path.join(__dirname, '../frontend/.env.local'), quiet: true });
const { chromium } = require('playwright');
const origin = process.env.HOME_VERIFY_ORIGIN || 'http://localhost:3001';
assert(['localhost', '127.0.0.1'].includes(new URL(origin).hostname), 'Local verification only');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const request = context.request;
    async function get(url) {
      let response = await request.get(url);
      for (let retry = 0; response.status() === 429 && retry < 3; retry++) {
        console.log('Rate limit respected; waiting before retrying the read-only check');
        await new Promise(resolve => setTimeout(resolve, 30000));
        response = await request.get(url);
      }
      assert.equal(response.status(), 200, new URL(url).pathname);
      return response;
    }
    assert(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, 'Existing local administrator credentials required');
    const csrf = await get(origin + '/api/auth/csrf');
    assert.equal(csrf.status(), 200);
    const { csrfToken } = await csrf.json();
    await request.post(origin + '/api/auth/callback/credentials', { maxRedirects: 0, form: { csrfToken, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, callbackUrl: origin + '/dashboard', json: 'true' } });
    const session = await get(origin + '/api/auth/session');
    assert.equal((await session.json()).user?.role, 'admin');
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (process.env.HOME_VERIFY_DESTINATIONS_ONLY === '1') {
      const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const destinations = [
        ['/dashboard/inventory?status=low', 'Necesitan reposición'],
        ['/dashboard/inventory?status=expired', 'Con unidades vencidas'],
        ['/dashboard/inventory?status=expiring', 'Vencen en 30 días'],
        ['/dashboard/pos?tab=caja&review=1', 'Por revisar'],
        [`/dashboard/consultas?date=${date}&scope=day&care=pending-record`, 'Historias pendientes'],
        ['/dashboard/peluqueria?stage=ready', 'Listas para entrega'],
        ['/dashboard/conversations?attention=human', 'Atención humana'],
      ];
      for (const [destination, label] of destinations.slice(Number(process.env.HOME_VERIFY_DESTINATION_START || 0))) {
        await page.goto(origin + destination, { waitUntil: 'networkidle', timeout: 60000 });
        const filter = page.getByRole('button', { name: new RegExp(label) }).first();
        try { await filter.waitFor(); } catch (error) {
          console.error(JSON.stringify({ destination, headings: await page.locator('main h1, main h2, main [role="alert"]').allTextContents(), filters: await page.locator('main button[aria-pressed]').allTextContents() }));
          throw error;
        }
        assert.equal(await filter.getAttribute('aria-pressed'), 'true', destination);
        console.log('PASS destination filter ' + destination);
      }
      assert.equal(errors.length, 0, errors.join('\n'));
      return;
    }
    await page.goto(origin + '/dashboard', { waitUntil: 'networkidle', timeout: 60000 });
    await page.getByRole('heading', { name: 'Necesita atención', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Resultados del negocio · hoy', exact: true }).count(), 1);
    assert.equal(await page.getByRole('heading', { name: /Recordatorios próximos|Recordatorios pendientes|El pulso de hoy/ }).count(), 0);
    const profile = await (await get(origin + '/api/proxy/dashboard/tenant/profile')).json();
    assert(await page.getByText(profile.name, { exact: true }).count() > 0);
    const cssIssues = () => page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, tinyLinks: [...document.querySelectorAll('main a')].filter(a => a.textContent.trim() && a.getBoundingClientRect().width < 5).length }));
    assert.equal((await cssIssues()).overflow, false, 'Desktop overflow');
    const directory = path.join(__dirname, '../.cache/home-verification');
    fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, 'desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal((await cssIssues()).overflow, false, 'Mobile overflow');
    await page.screenshot({ path: path.join(directory, 'mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Actualizar Inicio', exact: true }).first().click();
    await page.getByRole('button', { name: 'Actualizar Inicio', exact: true }).first().waitFor();
    await page.waitForLoadState('networkidle');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS local administrator: authenticated home, one priority section, one financial section, establishment identity, refresh, desktop/mobile without overflow or browser errors');
    // Read each permitted source through the authenticated proxy; no writes.
    const access = await (await get(origin + '/api/proxy/dashboard/access')).json();
    for (const source of ['/conversations?attention=human&limit=2', ...(access.capabilities.agenda ? ['/appointments/today'] : []), ...(access.capabilities.clinical ? ['/appointments/week'] : []), ...(access.capabilities.grooming ? ['/grooming/appointments'] : []), ...(access.capabilities.cash ? ['/cash/operational'] : []), ...(access.capabilities.inventory_read ? ['/inventory/products?status=low&limit=1', '/inventory/products?status=expired&limit=1', '/inventory/products?status=expiring&limit=1'] : []), ...(access.capabilities.administration && access.capabilities.services ? ['/next-actions/upcoming?limit=6'] : []), '/metrics/cashbox']) {
      const response = await get(origin + '/api/proxy/dashboard' + source);
      assert.equal(response.status(), 200, source);
      console.log('PASS authenticated source ' + source.split('?')[0]);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
