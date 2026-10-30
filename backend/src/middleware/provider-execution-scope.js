const { withTenant } = require('../services/whatsapp-route.service');
function providerExecutionScope(req, _res, next) {
  const tenantId = req.tenant?.tenantId;
  if (!tenantId) return next();
  // A messaging failure must not disable ordinary dashboard operations.
  return withTenant(tenantId, () => next()).catch(next);
}
module.exports = { providerExecutionScope };
