/**
 * Domain rule — habilitación de categorías de servicio según los módulos
 * activos del establecimiento (contexto Negocio).
 *
 * Función pura: recibe el nombre de la categoría y la lista de módulos
 * activos ya leída por BusinessConfigReader; no consulta nada por su cuenta.
 */

const CATEGORY_REQUIRED_MODULE = Object.freeze({
  grooming: "grooming",
  veterinary: "veterinary",
});

/**
 * @param {string} categoryName
 * @param {string[]} activeModules
 * @returns {boolean}
 */
function isCategoryEnabled(categoryName, activeModules = []) {
  const requiredModule = CATEGORY_REQUIRED_MODULE[categoryName];
  if (!requiredModule) return true; // categorías sin módulo asociado (p. ej. "other") están siempre habilitadas
  return activeModules.includes(requiredModule);
}

module.exports = { isCategoryEnabled, CATEGORY_REQUIRED_MODULE };
