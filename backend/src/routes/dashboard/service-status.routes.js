const router = require('express').Router();
const { buildDashboardServiceStatus } = require('../../services/dashboard-service-status');
router.get('/service-status', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    return res.json(await buildDashboardServiceStatus()(req.tenant?.tenantId));
  } catch (error) {
    return res.status(error.status === 403 ? 403 : 503).json({ error: 'No se pudo comprobar el estado del servicio. Reintenta la consulta.' });
  }
});
module.exports = router;
