/**
 * Domain rule — determina qué capacidades se agregan y cuáles se retiran al
 * comparar el conjunto solicitado contra el conjunto activo actual.
 *
 * Función pura: no persiste nada, solo calcula la diferencia.
 */
function diffCapabilities(currentActiveServiceIds, requestedServiceIds) {
  const current = new Set(currentActiveServiceIds);
  const requested = new Set(requestedServiceIds);

  const toAdd = [...requested].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !requested.has(id));

  return { toAdd, toRemove };
}

module.exports = { diffCapabilities };
