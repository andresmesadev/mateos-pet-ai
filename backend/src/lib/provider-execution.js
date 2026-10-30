const { AsyncLocalStorage } = require('node:async_hooks');
const execution = new AsyncLocalStorage();
const providerScope = () => execution.getStore() || null;
function runProviderScope(scope, fn) {
  if (!scope || typeof scope.tenantId !== 'string' || !scope.tenantId) throw new Error('PROVIDER_TENANT_REQUIRED');
  return execution.run({ ...scope, aiOrdinal: 0 }, fn);
}
function routeSnapshot(route) {
  return route ? { tenantId: route.tenantId, receiver: route.receiver, connectionId: route.connectionId ?? null, routeVersion: route.routeVersion ?? 0 } : null;
}
module.exports = { providerScope, runProviderScope, routeSnapshot };
