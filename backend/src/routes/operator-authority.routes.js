const router = require('express').Router();
for (const method of ['state','register']) router.post(`/${method}`, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try { res.json(await require('../contexts').operatorChannel.authority[method](req.body)); }
  catch (e) { res.status(e.status || 403).json({ code: e.status ? e.code : 'INVALID_AUTHORITY_PROOF', error: 'No se pudo verificar la autoridad privada.' }); }
});
module.exports = router;
