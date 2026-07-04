/**
 * Evaluación de la Condición de una Regla de Automatización (Etapa 1, Decisión 3):
 * predicado plano de igualdad contra el payload del Evento de Dominio — sin
 * anidamiento, sin operadores, sin ejecución de código. `condition` nulo
 * significa "siempre aplica".
 */
function matchesCondition(condition, payload) {
  if (condition == null) return true;
  const data = payload ?? {};
  return Object.entries(condition).every(([key, value]) => data[key] === value);
}

module.exports = { matchesCondition };
