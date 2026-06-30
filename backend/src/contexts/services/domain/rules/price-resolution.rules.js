/**
 * Domain rule — jerarquía de resolución de precio del contexto Servicios.
 *
 * Implementa el orden de prioridad documentado en el Modelo de Dominio y en
 * servicios-modelo-persistencia.md: mascota > cliente > raza/tamaño > catálogo base.
 *
 * Función pura: no conoce Prisma, no conoce HTTP, no consulta nada por su cuenta.
 * Recibe ya resueltas las reglas de precio activas del servicio y los atributos
 * de destino relevantes (petId, clientId, breedId, size), y solo decide cuál
 * nivel aplica. Cumple el Principio Permanente: "el Price Resolver no cambia
 * cuando aparecen nuevas reglas de precio; solo crecen las fuentes que consulta".
 */

const PRICE_SOURCES = Object.freeze({
  PET_AGREED_PRICE: "pet_agreed_price",
  CLIENT_AGREED_PRICE: "client_agreed_price",
  BREED_PRICE: "breed_price",
  SIZE_PRICE: "size_price",
  SERVICE_BASE_PRICE: "service_base_price",
  UNRESOLVED: "unresolved",
});

function findActiveRule(priceRules, targetType, targetId) {
  if (targetId == null) return null;
  return (
    priceRules.find(
      (rule) => rule.active && rule.targetType === targetType && rule.targetId === targetId
    ) || null
  );
}

/**
 * @param {Object} input
 * @param {Array}  input.priceRules - reglas de precio activas e inactivas del servicio (PriceRule[])
 * @param {number|null} input.basePrice - Service.basePrice
 * @param {string|null} [input.petId]
 * @param {string|null} [input.clientId]
 * @param {string|null} [input.breedId]
 * @param {string|null} [input.size]
 * @returns {{ finalPrice: number|null, source: string, trace: Array<{level: string, targetId: string|null, price: number|null}> }}
 */
function resolveServicePrice({ priceRules = [], basePrice = null, petId = null, clientId = null, breedId = null, size = null }) {
  const levels = [
    { level: PRICE_SOURCES.PET_AGREED_PRICE, targetType: "pet", targetId: petId },
    { level: PRICE_SOURCES.CLIENT_AGREED_PRICE, targetType: "client", targetId: clientId },
    { level: PRICE_SOURCES.BREED_PRICE, targetType: "breed", targetId: breedId },
    { level: PRICE_SOURCES.SIZE_PRICE, targetType: "size", targetId: size },
  ];

  const trace = [];

  for (const { level, targetType, targetId } of levels) {
    const rule = findActiveRule(priceRules, targetType, targetId);
    trace.push({ level, targetId, price: rule ? Number(rule.price) : null });
    if (rule) {
      return { finalPrice: Number(rule.price), source: level, trace };
    }
  }

  const sb = basePrice != null ? Number(basePrice) : null;
  trace.push({ level: PRICE_SOURCES.SERVICE_BASE_PRICE, targetId: null, price: sb });

  if (sb !== null && !isNaN(sb)) {
    return { finalPrice: sb, source: PRICE_SOURCES.SERVICE_BASE_PRICE, trace };
  }

  return { finalPrice: null, source: PRICE_SOURCES.UNRESOLVED, trace };
}

module.exports = { resolveServicePrice, PRICE_SOURCES };
