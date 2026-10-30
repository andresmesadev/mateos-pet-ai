const assert = require('node:assert/strict');
const path = require('node:path');
const { recordOpenAIProbe } = require('../backend/src/services/provider-health-observation');
module.exports = async ({ prisma, base, businesses, output, check }) => {
  const original = { ...process.env };
  const before = await prisma.transaction.findMany({ orderBy: { id: 'asc' }, include: { items: true } });
  try {
    process.env.WHATSAPP_ENABLED = 'false'; process.env.AI_QUOTA_ENABLED = 'false';
    for (const b of businesses) {
      const foreign = businesses.find(x => x !== b).tenant.id;
      const data = await b.api('get', '/service-status?tenantId=' + foreign);
      assert.equal(data.tenantId, b.tenant.id);
      assert.equal(data.whatsapp.state, 'paused'); assert.equal(data.ai.state, 'unverified');
      assert.deepEqual(Object.keys(data).sort(), ['ai', 'checkedAt', 'dashboard', 'tenantId', 'whatsapp']);
      assert(!JSON.stringify(data).includes(foreign));
      await b.page.goto(base + '/dashboard');
      const panel = b.page.getByRole('region', { name: 'Estado del servicio', exact: true });
      await panel.getByText('En pausa', { exact: true }).waitFor();
      await panel.getByText('Sin sondeo reciente', { exact: true }).waitFor();
      for (const width of [320, 390, 1440]) {
        await b.page.setViewportSize({ width, height: 1000 });
        assert(await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await panel.screenshot({ path: path.join(output, `status-${b.module}-${width}.png`) });
      }
      check(`${b.module}: own status despite foreign query, WhatsApp paused, AI unverified; manual cycles remain intact and panel fits 320/390/1440`);
    }
    const b = businesses[0], panel = b.page.getByRole('region', { name: 'Estado del servicio', exact: true });
    await b.page.setViewportSize({ width: 390, height: 1000 });
    await b.page.route('**/api/proxy/dashboard/service-status?*', route => route.fulfill({ status: 503, json: { error: 'synthetic failure' } }));
    await panel.getByRole('button', { name: 'Actualizar estado', exact: true }).click();
    await panel.getByRole('alert').waitFor(); assert.equal(await panel.getByText('En pausa', { exact: true }).count(), 0);
    await b.page.unroute('**/api/proxy/dashboard/service-status?*');
    await b.page.route('**/api/proxy/dashboard/service-status?*', route => route.fulfill({ json: { tenantId: businesses[1].tenant.id, checkedAt: new Date().toISOString(), dashboard: { state: 'responding' }, whatsapp: { state: 'configured' }, ai: { state: 'observed_ok' } } }));
    await panel.getByRole('button', { name: 'Actualizar estado', exact: true }).click();
    await panel.getByRole('alert').waitFor(); assert.equal(await panel.getByText('Sondeo reciente correcto', { exact: true }).count(), 0);
    await b.page.unroute('**/api/proxy/dashboard/service-status?*');
    recordOpenAIProbe(false);
    await panel.getByRole('button', { name: 'Actualizar estado', exact: true }).click();
    await panel.getByText('Proveedor con incidencias', { exact: true }).waitFor();
    await panel.screenshot({ path: path.join(output, 'status-provider-degraded-390.png') });
    recordOpenAIProbe(true);
    await panel.getByRole('button', { name: 'Actualizar estado', exact: true }).click();
    await panel.getByText('Sondeo reciente correcto', { exact: true }).waitFor();
    check('status refresh clears stale success, rejects a foreign response, recovers from 503 and reflects failed/successful probe evidence without contacting providers');

    process.env.AI_QUOTA_ENABLED = 'true'; delete process.env.AI_OPERATION_UNITS_JSON;
    assert.equal((await b.api('get', '/service-status')).ai.state, 'policy_pending');
    process.env.AI_QUOTA_POLICY_VERSION = 'qa-service-visibility';
    process.env.AI_OPERATION_UNITS_JSON = JSON.stringify({ analyze: 1, reply: 1, embedding: 1, transcription: 1, interpret: 1 });
    assert.equal((await b.api('get', '/service-status')).ai.state, 'quota_pending');
    await prisma.aiQuotaConfig.create({ data: { tenantId: b.tenant.id, monthlyLimit: 0 } });
    await panel.getByRole('button', { name: 'Actualizar estado', exact: true }).click();
    await panel.getByText('Cupo agotado', { exact: true }).waitFor();
    await panel.screenshot({ path: path.join(output, 'status-quota-exhausted-390.png') });
    await prisma.aiQuotaConfig.update({ where: { tenantId: b.tenant.id }, data: { monthlyLimit: 1000 } });
    await panel.getByRole('button', { name: 'Actualizar estado', exact: true }).click();
    await panel.getByText('Sondeo reciente correcto', { exact: true }).waitFor();
    check('real tenant quota states distinguish policy, assignment and exhaustion, then recover after configuration');
    assert.deepEqual(await prisma.transaction.findMany({ orderBy: { id: 'asc' }, include: { items: true } }), before);
    assert.equal(await prisma.aiUsageEntry.count(), 0);
    check('status consultation writes no sale or AI usage and preserves official closed-day amounts');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
};
