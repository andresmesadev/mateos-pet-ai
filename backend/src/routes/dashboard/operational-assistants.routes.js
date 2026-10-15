const express = require('express');
const router = express.Router();
const { operationalAssistants: app } = require('../../contexts');
const { keys, fail } = require('../../contexts/agents/application/operational/policy');
const logger = require('../../lib/logger');
const identity = req => ({ tenantId: req.tenant?.tenantId, viewAllTenants: req.tenant?.viewAllTenants, actor: req.actor });
const route = fn => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json(await fn(req)); }
  catch (e) {
    const known = e.status || (e.name?.endsWith('NotFoundError') ? 404 : e.name?.startsWith('Invalid') ? 422 : null);
    if (!known) logger.error('[OperationalAssistant] Request failed', { code: e.code || e.name });
    res.status(known || 503).json({ code: e.code || (known ? e.name : 'RESULT_UNCERTAIN'), error: known ? e.message : 'No se pudo comprobar el resultado. Recupera la atención antes de repetir.' });
  }
};
const base = '/operational-assistants';
router.get(`${base}/whatsapp`, route(req => require('../../contexts').operatorChannel.linking.status(identity(req))));
for (const method of ['start','activate','renew']) router.post(`${base}/whatsapp/${method}`, route(req => {
  keys(req.body, method === 'start' ? ['phone','proof'] : method === 'activate' ? ['challengeId','proof'] : ['linkId','proof']);
  return require('../../contexts').operatorChannel.linking[method](identity(req), req.body);
}));
router.post(`${base}/whatsapp/revoke`, route(req => { keys(req.body, ['linkId']); return require('../../contexts').operatorChannel.linking.revoke(identity(req), req.body.linkId); }));
router.post(`${base}/whatsapp/acknowledge`, route(async req => {
  keys(req.body, ['jobId']); const result = await require('../../contexts').operatorChannel.linking.acknowledge(identity(req), req.body);
  require('../../jobs/inbound-message.job').requestInboundDrain(); return result;
}));
router.get(base, route(req => app.list(identity(req), req.query)));
router.post(`${base}/:employeeId/requests`, route(req => app.request(identity(req), req.params.employeeId, req.body)));
router.get(`${base}/tasks/:taskId`, route(req => app.getTask(identity(req), req.params.taskId)));
router.get(`${base}/actions/:actionId`, route(req => app.getAction(identity(req), req.params.actionId)));
router.patch(`${base}/actions/:actionId`, route(req => { keys(req.body, ['expectedRevision','patch']); return app.revise(identity(req), req.params.actionId, req.body.expectedRevision, req.body.patch); }));
for (const verb of ['confirm','discard','refresh']) router.post(`${base}/actions/:actionId/${verb}`, route(req => {
  keys(req.body, ['expectedRevision']); if (!Number.isInteger(req.body.expectedRevision)) fail('INVALID_INPUT', 'Revisión no válida.', 400);
  return app[verb](identity(req), req.params.actionId, req.body.expectedRevision);
}));
module.exports = router;
