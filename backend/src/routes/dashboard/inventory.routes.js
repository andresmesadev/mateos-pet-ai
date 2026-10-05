const router = require('express').Router();
const { inventory } = require('../../contexts');
const { mapTransaction } = require('./shared');
const adapt = fn => async (req, res) => {
  try { const value = await fn(req); res.json(value); }
  catch (e) {
    if (e.status && e.code) return res.status(e.status).json({ error: e.message, code: e.code });
    console.error('[Inventory]', e.code ?? e.name, e.message);
    res.status(503).json({ error: 'No se pudo comprobar el resultado. Reintenta la misma operación o consulta su resultado.', code: 'RESULT_UNCERTAIN' });
  }
};
const identity = req => ({ tenantId: req.tenant.tenantId, actor: req.actor });
const command = (req, kind, extras = {}) => ({ ...identity(req), kind, operationKey: req.get('Idempotency-Key'), command: { ...(req.body ?? {}), ...extras } });
router.get('/inventory/context', adapt(req => inventory.reads.context(identity(req))));
router.get('/inventory/products', adapt(req => inventory.reads.list({ ...identity(req), query: req.query })));
router.get('/inventory/products/:id', adapt(req => inventory.reads.detail({ ...identity(req), id: req.params.id })));
router.get('/inventory/products/:id/movements', adapt(req => inventory.reads.movements({ ...identity(req), id: req.params.id, cursor: req.query.cursor })));
router.post('/inventory/products', adapt(req => inventory.commands.catalogue(command(req, 'create_product'))));
router.patch('/inventory/products/:id', adapt(req => inventory.commands.catalogue(command(req, typeof req.body?.active === 'boolean' && Object.keys(req.body).every(k => ['active','expectedVersion'].includes(k)) ? 'set_product_active' : 'update_product', { productId: req.params.id }))));
router.post('/inventory/products/:id/entries', adapt(req => inventory.commands.entry(command(req, 'register_entry', { productId: req.params.id }))));
router.post('/inventory/products/:id/adjustments', adapt(req => inventory.commands.adjust(command(req, 'adjust_stock', { productId: req.params.id }))));
router.post('/inventory/consumptions', adapt(req => inventory.commands.consume(command(req, 'register_consumption'))));
router.post('/inventory/consumptions/:id/corrections', adapt(req => inventory.commands.correct(command(req, 'correct_consumption', { sourceOperationId: req.params.id }))));
router.post('/transactions/:id/inventory-returns', adapt(req => inventory.commands.returnItems(command(req, 'return_sale_items', { transactionId: req.params.id }))));
router.get('/inventory/operations/:key', adapt(req => inventory.commands.recover({ ...identity(req), kind: req.query.kind, operationKey: req.params.key })));
router.get('/pos/operations/:key', adapt(async req => {
  const r = await inventory.commands.recover({ ...identity(req), kind: 'confirm_pos_sale', operationKey: req.params.key });
  return { ...mapTransaction(r.transaction), operationId: r.operationId, replayed: true };
}));
module.exports = router;
